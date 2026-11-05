const PHONE = /^84\d{9,10}$/u
const DAY = /^\d{4}-\d{2}-\d{2}$/u

/** A Vietnamese phone as `84` followed by nine or ten digits, or null when it is not a plausible number. */
export const toLoyaltyPhone = (raw: string | null): string | null => {
    const digits = (raw ?? "").replace(/\D/gu, "")
    const national = digits.startsWith("00") ? digits.slice(2) : digits
    const full = national.startsWith("0") ? `84${national.slice(1)}` : national
    const withCountry = !full.startsWith("84") && (full.length === 9 || full.length === 10) ? `84${full}` : full
    return PHONE.test(withCountry) ? withCountry : null
}

/** A real calendar date for a profile birthday, or null for an empty or invalid date. */
export const customerBirthday = (value: string | null): string | null => {
    if (value === null || !DAY.test(value)) return null
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}
