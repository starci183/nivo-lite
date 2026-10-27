/** A Vietnamese mobile number as ZNS takes it: 84 and the nine digits after the leading zero (a Zalo account is a mobile). */
const ZNS_PHONE = /^84[35789]\d{8}$/u

/** Separators people type inside a phone number. */
const SEPARATORS = /[\s.\-()]/gu

/** The national digits of a number, without the country code or the trunk zero. */
const nationalOf = (digits: string): string => {
    if (digits.startsWith("0084")) return digits.slice(4)
    if (digits.startsWith("84") && digits.length === 11) return digits.slice(2)
    if (digits.startsWith("0")) return digits.slice(1)
    return digits
}

/**
 * A Vietnamese phone in the form ZNS takes (`84xxxxxxxxx`), or null when the text cannot be one. Accepts `0912 345 678`,
 * `+84 912.345.678`, `0084912345678`, `84912345678` and the bare nine digits `912345678`.
 */
export const normaliseVnPhone = (raw: string | null | undefined): string | null => {
    const compact = (raw ?? "").trim().replace(SEPARATORS, "")
    if (!/^\+?\d+$/u.test(compact)) return null
    const phone = `84${nationalOf(compact.replace(/^\+/u, ""))}`
    return ZNS_PHONE.test(phone) ? phone : null
}
