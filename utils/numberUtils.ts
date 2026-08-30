/**
 * Utility functions for numeric calculations and formatting.
 */

/**
 * Rounds a number to a specified number of decimal places cleanly.
 * @param value The numeric value to round
 * @param decimals Number of decimal places (default is 2)
 * @returns Rounded number
 */
export const round = (value: number, decimals: number = 2): number => {
  if (value === null || value === undefined || isNaN(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
