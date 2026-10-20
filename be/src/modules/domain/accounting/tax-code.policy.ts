/** The check-digit weights of the first nine digits of a Vietnamese enterprise tax code (MST). */
const WEIGHTS = [31, 29, 23, 19, 17, 13, 7, 5, 3]

/** A tax code without spaces, dots or a branch dash, e.g. `0100109106-001` -> `0100109106001`. */
export const normalizeTaxCode = (value: string): string => value.replaceAll(/[\s.-]/gu, "")

/** True when the 10 digits pass the MST check digit: 10 - (sum of d_i * w_i mod 11) equals the tenth digit. */
const checkDigitHolds = (digits: string): boolean => {
    const sum = WEIGHTS.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0)
    return 10 - (sum % 11) === Number(digits[9])
}

/**
 * Whether a tax code is well formed and valid: a 10-digit enterprise code (or a 13-digit branch code `NNNNNNNNNN-NNN`) whose
 * check digit holds, or a 12-digit personal identification number (individuals, Circular 86/2024/TT-BTC).
 */
export const isValidTaxCode = (value: string): boolean => {
    const trimmed = value.trim()
    if (/^\d{12}$/u.test(trimmed)) return true
    if (!/^\d{10}(?:-?\d{3})?$/u.test(trimmed)) return false
    return checkDigitHolds(trimmed.slice(0, 10))
}

/** True when two tax codes name the same taxpayer, ignoring separators. */
export const sameTaxCode = (left: string, right: string): boolean =>
    normalizeTaxCode(left) !== "" && normalizeTaxCode(left) === normalizeTaxCode(right)
