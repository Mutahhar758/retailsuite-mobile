import type { Item } from '../services/inventoryService';

export interface ParsedBarcodeResult {
  matchedItem: Item;
  qty: number;
  rate?: number;
  amount?: number;
  isVariableWeight: boolean;
  unit?: string;
  rawCode: string;
}

export interface ScaleBarcodeConfig {
  scalePrefixes?: string[]; // e.g. ['20', '21', '22', '23', '24', '25', '28']
  itemCodeLength?: number;  // 4 or 5 digits, default 5
  weightDecimals?: number;  // default 3 (grams to kg: / 1000)
  priceDecimals?: number;   // default 2 or 0
}

/**
 * Resolves user-friendly unit title (e.g. 'kg', 'pcs') instead of raw numeric unit ID/code (e.g. '004', '1').
 */
export function resolveItemUnitTitle(item?: Item | null): string {
  if (!item) return 'kg';
  if (item.defaultUnitTitle && item.defaultUnitTitle.trim()) return item.defaultUnitTitle.trim();
  if (item.primaryUnitTitle && item.primaryUnitTitle.trim()) return item.primaryUnitTitle.trim();
  if (item.defaultUnit && isNaN(Number(item.defaultUnit))) return item.defaultUnit.trim();
  if (item.primaryUnit && isNaN(Number(item.primaryUnit))) return item.primaryUnit.trim();
  return 'kg';
}

const DEFAULT_SCALE_PREFIXES = ['20', '21', '22', '23', '24', '25', '28'];

/**
 * Parses an incoming barcode or scanner input and resolves it against the inventory items list.
 * Supports:
 * 1. RetailSuite Smart Code-128: "VW-{ItemCode}-Q{qty}-R{rate}" (or with -P{amount})
 * 2. Delimited format: "{code}*{qty}*{rate}"
 * 3. Mart Weighing Machine Barcodes (EAN-13):
 *    - Prefix 21 / 28 (Weight-embedded): 21 IIIII WWWWW C -> e.g. 2100123011005 (Item 123, 1.100 kg)
 *    - Prefix 20 / 22 (Price-embedded):  20 IIIII PPPPP C -> e.g. 2000123005002 (Item 123, Rs. 500)
 * 4. Multiplier syntax: "5*890123" or "890123*5"
 * 5. Standard item lookup: Exact barcode, item ID, itemKey, exact title, single partial match.
 */
export function parseBarcodePayload(
  rawInput: string,
  items: Item[],
  scaleConfig?: ScaleBarcodeConfig
): ParsedBarcodeResult | null {
  const raw = (rawInput || '').trim();
  if (!raw || items.length === 0) return null;

  const cleanDigits = raw.replace(/\D/g, '');

  // 0a. RetailSuite Compact 12-digit All-Numeric Variable Barcode (Qty Only): 2 + IIIIII + QQQQQ
  if (cleanDigits.length === 12 && cleanDigits.startsWith('2')) {
    const itemPart = cleanDigits.substring(1, 7);
    const qtyPart = cleanDigits.substring(7, 12);

    const item = findItemByPlu(itemPart, items) || findItemByCode(itemPart, items);
    if (item) {
      const parsedQty = round3(parseInt(qtyPart, 10) / 1000);
      const effectiveRate = item.priRate || 0;
      const totalAmt = round2(parsedQty * effectiveRate);

      return {
        matchedItem: item,
        qty: parsedQty,
        rate: effectiveRate,
        amount: totalAmt,
        isVariableWeight: true,
        unit: resolveItemUnitTitle(item),
        rawCode: raw
      };
    }
  }

  // 0b. RetailSuite Compact 18-digit Variable Barcode: 2 + IIIIII + QQQQQ + AAAAAA
  if (cleanDigits.length === 18 && cleanDigits.startsWith('2')) {
    const itemPart = cleanDigits.substring(1, 7);
    const qtyPart = cleanDigits.substring(7, 12);
    const amtPart = cleanDigits.substring(12, 18);

    const item = findItemByPlu(itemPart, items) || findItemByCode(itemPart, items);
    if (item) {
      const parsedQty = round3(parseInt(qtyPart, 10) / 1000);
      const rawAmt = parseInt(amtPart, 10);
      let effectiveRate: number;
      let totalAmt: number;

      if (rawAmt > 0) {
        totalAmt = round2(rawAmt);
        effectiveRate = parsedQty > 0 ? round2(totalAmt / parsedQty) : (item.priRate || 0);
      } else {
        effectiveRate = item.priRate || 0;
        totalAmt = round2(parsedQty * effectiveRate);
      }

      return {
        matchedItem: item,
        qty: parsedQty,
        rate: effectiveRate,
        amount: totalAmt,
        isVariableWeight: true,
        unit: resolveItemUnitTitle(item),
        rawCode: raw
      };
    }
  }

  // 1. RetailSuite Variable Code-128: VW-{ItemCode}-Q{qty}-R{rate}
  if (raw.toUpperCase().startsWith('VW-') || raw.toUpperCase().startsWith('VW:')) {
    const withoutPrefix = raw.slice(3).trim();
    const regex = /^(.+?)[-:]Q([\d.]+)(?:[-:]([RP])([\d.]+))?$/i;
    const match = withoutPrefix.match(regex);

    if (match) {
      const codePart = match[1].trim();
      const parsedQty = parseFloat(match[2]);
      const priceType = (match[3] || '').toUpperCase();
      const priceVal = match[4] ? parseFloat(match[4]) : undefined;

      const item = findItemByCode(codePart, items);
      if (item && !isNaN(parsedQty) && parsedQty > 0) {
        let effectiveRate = item.priRate || 0;
        let effectiveAmount: number | undefined;

        if (priceType === 'P' && priceVal !== undefined && !isNaN(priceVal)) {
          effectiveAmount = round2(priceVal);
          effectiveRate = round2(effectiveAmount / parsedQty);
        } else if (priceType === 'R' && priceVal !== undefined && !isNaN(priceVal)) {
          effectiveRate = round2(priceVal);
          effectiveAmount = round2(parsedQty * effectiveRate);
        } else {
          effectiveAmount = round2(parsedQty * effectiveRate);
        }

        return {
          matchedItem: item,
          qty: parsedQty,
          rate: effectiveRate,
          amount: effectiveAmount,
          isVariableWeight: true,
          unit: resolveItemUnitTitle(item),
          rawCode: raw
        };
      }
    }
  }

  // 2. Delimited Syntax: {ItemCode}*{qty} or {ItemCode}*{qty}*{rate}
  if (raw.includes('*')) {
    const starParts = raw.split('*');
    if (starParts.length === 3 || starParts.length === 2) {
      const codePart = starParts[0].trim();
      const qVal = parseFloat(starParts[1].trim());
      const rVal = starParts.length === 3 ? parseFloat(starParts[2].trim()) : NaN;
      const item = findItemByCode(codePart, items);

      if (item && !isNaN(qVal) && qVal > 0) {
        const rate = !isNaN(rVal) && rVal >= 0 ? round2(rVal) : (item.priRate || 0);
        return {
          matchedItem: item,
          qty: qVal,
          rate,
          amount: round2(qVal * rate),
          isVariableWeight: true,
          unit: resolveItemUnitTitle(item),
          rawCode: raw
        };
      }
    }
  }

  // 3. Mart Weighing Machine Barcodes (EAN-13 Scale Barcodes)
  if (cleanDigits.length === 13) {
    const prefixes = scaleConfig?.scalePrefixes || DEFAULT_SCALE_PREFIXES;
    const prefix = cleanDigits.substring(0, 2);

    if (prefixes.includes(prefix)) {
      const codeLen = scaleConfig?.itemCodeLength ?? 5;
      const pluString = cleanDigits.substring(2, 2 + codeLen);
      const valueString = cleanDigits.substring(2 + codeLen, 12);

      const item = findItemByPlu(pluString, items);

      if (item) {
        const rawValue = parseInt(valueString, 10);
        const isWeightScale = prefix === '21' || prefix === '28' || prefix === '23';

        if (isWeightScale) {
          const weightKg = round3(rawValue / 1000);
          const rate = item.priRate || 0;
          const amount = round2(weightKg * rate);

          return {
            matchedItem: item,
            qty: weightKg,
            rate,
            amount,
            isVariableWeight: true,
            unit: resolveItemUnitTitle(item),
            rawCode: raw
          };
        } else {
          const totalPrice = round2(rawValue);
          const baseRate = item.priRate || 0;
          const calculatedQty = baseRate > 0 ? round3(totalPrice / baseRate) : 1;

          return {
            matchedItem: item,
            qty: calculatedQty,
            rate: baseRate > 0 ? baseRate : totalPrice,
            amount: totalPrice,
            isVariableWeight: true,
            unit: resolveItemUnitTitle(item),
            rawCode: raw
          };
        }
      }
    }
  }

  // 4. Multiplier syntax: "5*890123" or "890123*5"
  let scanQty = 1;
  let cleanCode = raw;

  if (raw.includes('*')) {
    const parts = raw.split('*');
    if (parts.length === 2) {
      const part0 = parts[0].trim();
      const part1 = parts[1].trim();
      const num0 = parseFloat(part0);
      const num1 = parseFloat(part1);

      if (findItemByCode(part1, items) && !isNaN(num0) && num0 > 0) {
        scanQty = num0;
        cleanCode = part1;
      } else if (findItemByCode(part0, items) && !isNaN(num1) && num1 > 0) {
        scanQty = num1;
        cleanCode = part0;
      } else if (!isNaN(num0) && num0 > 0 && num0 < 1000 && isNaN(num1)) {
        scanQty = num0;
        cleanCode = part1;
      } else if (!isNaN(num1) && num1 > 0 && num1 < 1000 && isNaN(num0)) {
        scanQty = num1;
        cleanCode = part0;
      }
    }
  }

  // 5. Standard item lookup (exact barcode, ID, SKU, title)
  const matchedItem = findItemByCode(cleanCode, items);
  if (matchedItem) {
    const rate = matchedItem.priRate || 0;
    return {
      matchedItem,
      qty: scanQty,
      rate,
      amount: round2(scanQty * rate),
      isVariableWeight: false,
      unit: resolveItemUnitTitle(matchedItem),
      rawCode: raw
    };
  }

  return null;
}

export function findItemByCode(codeToMatch: string, items: Item[]): Item | undefined {
  if (!codeToMatch) return undefined;
  const target = codeToMatch.trim().toLowerCase();

  let found = items.find(
    (i) => i.barcode && i.barcode.trim().toLowerCase() === target
  );

  if (!found) {
    found = items.find((i) => {
      const idStr = String(i.id ?? '').trim().toLowerCase();
      const catStr = String(i.itemCategoryCode ?? '').trim().toLowerCase();
      const numCat = catStr && /^\d+$/.test(catStr) ? String(parseInt(catStr, 10)) : '';
      const keyStr = i.itemKey ? i.itemKey.trim().toLowerCase() : '';

      if (idStr === target || (keyStr && keyStr === target)) return true;
      if (catStr && idStr) {
        if (`${catStr}-${idStr}` === target || `${catStr}${idStr}` === target) return true;
        if (numCat && (`${numCat}-${idStr}` === target || `${numCat}${idStr}` === target)) return true;
      }
      return false;
    });
  }

  if (!found) {
    found = items.find(
      (i) => i.title && i.title.trim().toLowerCase() === target
    );
  }

  if (!found && target.length >= 3) {
    const partialMatches = items.filter(
      (i) =>
        (i.barcode && i.barcode.toLowerCase().includes(target)) ||
        (i.title && i.title.toLowerCase().includes(target))
    );
    if (partialMatches.length === 1) {
      found = partialMatches[0];
    }
  }

  return found;
}

function findItemByPlu(plu: string, items: Item[]): Item | undefined {
  const cleanPlu = plu.trim();
  const numericPlu = String(parseInt(cleanPlu, 10));

  return items.find((i) => {
    if (i.barcode && i.barcode.trim().toLowerCase() === cleanPlu.toLowerCase()) return true;
    if (String(i.id).trim() === cleanPlu || String(i.id).trim() === numericPlu) return true;
    if (i.itemKey && (i.itemKey.trim() === cleanPlu || i.itemKey.trim() === numericPlu)) return true;
    return false;
  });
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function round3(val: number): number {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}
