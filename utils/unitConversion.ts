import type { Item, Unit } from '../services/inventoryService';

export interface AdditionalUnitOption {
  unitId: string;
  unitTitle: string;
  shortTitle?: string | null;
  /** How many of this sub-unit equal 1 Primary Unit (must be > 1, e.g. 1000 for g -> kg) */
  factor: number;
}

export interface SelectableUnitOption {
  unitId: string;
  label: string;
  shortLabel: string;
  /** 1 for Primary Unit, > 1 for sub-units (e.g. 1000 for g) */
  factor: number;
  isPrimary: boolean;
}

export function getUnitShortLabel(unit?: Partial<Unit> | null, fallback = ''): string {
  if (!unit) return fallback;
  return (unit.shortTitle && unit.shortTitle.trim()) || unit.title || fallback;
}

/**
 * Resolves effective sub-units for an item:
 * 1. If `item.additionalUnits` is explicitly set (including `"[]"`), uses that override.
 * 2. Otherwise inherits all child units from `allUnits` where `parentUnitId === item.primaryUnit` and `conversionRatio > 1`.
 */
export function getEffectiveSubUnits(
  item?: Pick<Item, 'primaryUnit' | 'additionalUnits'> | null,
  allUnits: Unit[] = []
): AdditionalUnitOption[] {
  if (!item) return [];

  if (item.additionalUnits && item.additionalUnits.trim() !== '') {
    try {
      const parsed = JSON.parse(item.additionalUnits);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(x => x && Number(x.factor) > 1)
          .map(x => {
            const matched = allUnits.find(u =>
              String(u.code).trim().toLowerCase() === String(x.unitId || '').trim().toLowerCase()
            );
            return {
              unitId: String(x.unitId || ''),
              unitTitle: x.unitTitle || matched?.title || String(x.unitId || ''),
              shortTitle: x.shortTitle || matched?.shortTitle || null,
              factor: Number(x.factor),
            };
          });
      }
    } catch {
      // Fallback to parent unit inheritance
    }
  }

  if (!item.primaryUnit) return [];

  const priNorm = String(item.primaryUnit).trim().toLowerCase();
  return allUnits
    .filter(u =>
      String(u.parentUnitId || '').trim().toLowerCase() === priNorm &&
      u.conversionRatio &&
      Number(u.conversionRatio) > 1
    )
    .map(u => ({
      unitId: u.code,
      unitTitle: u.title,
      shortTitle: u.shortTitle || null,
      factor: Number(u.conversionRatio),
    }));
}

/**
 * Returns the list of selectable units for the primary `Qty` field on Sale/POS/Purchase forms.
 * Only when `options.length > 1` should the unit selector dropdown be rendered.
 */
export function getSelectablePrimaryUnits(
  item?: Pick<Item, 'primaryUnit' | 'primaryUnitTitle' | 'additionalUnits'> | null,
  allUnits: Unit[] = []
): SelectableUnitOption[] {
  if (!item?.primaryUnit) return [];

  const priNorm = String(item.primaryUnit).trim().toLowerCase();
  const primaryUnitObj = allUnits.find(u => String(u.code).trim().toLowerCase() === priNorm);
  const primaryShort = getUnitShortLabel(primaryUnitObj, item.primaryUnitTitle || item.primaryUnit);

  const baseOption: SelectableUnitOption = {
    unitId: item.primaryUnit,
    label: primaryShort,
    shortLabel: primaryShort,
    factor: 1,
    isPrimary: true,
  };

  const subUnits = getEffectiveSubUnits(item, allUnits);
  const subOptions: SelectableUnitOption[] = subUnits.map(sub => {
    const shortLbl = (sub.shortTitle && sub.shortTitle.trim()) || sub.unitTitle;
    return {
      unitId: sub.unitId,
      label: shortLbl,
      shortLabel: shortLbl,
      factor: sub.factor,
      isPrimary: false,
    };
  });

  return [baseOption, ...subOptions];
}

/**
 * Converts a user-entered quantity in the selected unit (e.g. 50 in 'g' with factor 1000, or 1250 in 'g')
 * into the base Primary Unit quantity stored in the database (0.050 or 1.250).
 */
export function toBasePrimaryQty(enteredQty: number, factor = 1): number {
  const num = Number(enteredQty) || 0;
  if (!factor || factor <= 1) return num;
  return Number((num / factor).toFixed(6));
}

/**
 * Given a saved base Primary Unit quantity (e.g. 0.050, 0.250, 1.250, or 2.000),
 * converts into the item's sub-unit (e.g. 50 g, 250 g, 1250 g) if saved as sub-unit or fractional.
 */
export function resolveDisplayQtyAndUnit(
  baseQty: number,
  item?: Pick<Item, 'primaryUnit' | 'primaryUnitTitle' | 'additionalUnits'> | null,
  allUnits: Unit[] = [],
  savedUnitIdOrTitle = ''
): { displayQty: number; unitId: string; selectedUnitId: string; unitLabel: string; factor: number; isSubUnit: boolean } {
  const num = Number(baseQty) || 0;
  const selectable = getSelectablePrimaryUnits(item, allUnits);
  const primaryOpt = selectable[0];
  const defaultUnitId = primaryOpt?.unitId || item?.primaryUnit || '';
  const defaultLabel = primaryOpt?.shortLabel || savedUnitIdOrTitle || item?.primaryUnitTitle || '';

  if (selectable.length <= 1) {
    return {
      displayQty: Number(num.toFixed(4)),
      unitId: defaultUnitId,
      selectedUnitId: defaultUnitId,
      unitLabel: defaultLabel,
      factor: 1,
      isSubUnit: false,
    };
  }

  const subOptions = selectable.slice(1);
  const savedNorm = savedUnitIdOrTitle ? String(savedUnitIdOrTitle).trim().toLowerCase() : '';

  // 1. If savedUnit explicitly matches a sub-unit, respect it (even if whole integer)
  if (savedNorm) {
    const explicitSubMatch = subOptions.find(sub =>
      String(sub.unitId).trim().toLowerCase() === savedNorm ||
      String(sub.label).trim().toLowerCase() === savedNorm ||
      String(sub.shortLabel).trim().toLowerCase() === savedNorm
    );
    if (explicitSubMatch) {
      const converted = Number((num * explicitSubMatch.factor).toFixed(4));
      return {
        displayQty: Math.abs(converted - Math.round(converted)) < 0.001 ? Math.round(converted) : converted,
        unitId: explicitSubMatch.unitId,
        selectedUnitId: explicitSubMatch.unitId,
        unitLabel: explicitSubMatch.shortLabel,
        factor: explicitSubMatch.factor,
        isSubUnit: true,
      };
    }
  }

  // 2. If it's a fractional base quantity (e.g. 0.050 kg, 0.250 kg, 1.250 kg), resolve to sub-unit
  const isFractional = num > 0 && Math.abs(num % 1) >= 1e-5;
  if (isFractional) {
    const cleanMatch =
      subOptions.find(sub => {
        const candidate = num * sub.factor;
        return Math.abs(candidate - Math.round(candidate)) < 0.001;
      }) || subOptions[0];

    const converted = Number((num * cleanMatch.factor).toFixed(4));
    return {
      displayQty: Math.abs(converted - Math.round(converted)) < 0.001 ? Math.round(converted) : converted,
      unitId: cleanMatch.unitId,
      selectedUnitId: cleanMatch.unitId,
      unitLabel: cleanMatch.shortLabel,
      factor: cleanMatch.factor,
      isSubUnit: true,
    };
  }

  // 3. Whole numbers stay in primary unit by default
  return {
    displayQty: Number(num.toFixed(4)),
    unitId: defaultUnitId,
    selectedUnitId: defaultUnitId,
    unitLabel: defaultLabel,
    factor: 1,
    isSubUnit: false,
  };
}

export function formatSmartQtyWithUnit(
  baseQty: number,
  item?: Pick<Item, 'primaryUnit' | 'primaryUnitTitle' | 'additionalUnits'> | null,
  allUnits: Unit[] = [],
  fallbackUnitTitle = ''
): string {
  const { displayQty, unitLabel } = resolveDisplayQtyAndUnit(baseQty, item, allUnits, fallbackUnitTitle);
  const qtyStr = Number.isInteger(displayQty)
    ? displayQty.toLocaleString()
    : displayQty.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unitLabel ? `${qtyStr} ${unitLabel}` : qtyStr;
}
