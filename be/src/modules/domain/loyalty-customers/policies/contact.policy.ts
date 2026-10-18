import { hasEmailAddressShape } from "@modules/platform/primitives"
import type { MaybeText } from "../loyalty-customers.contracts"

const PHONE = /^84\d{9,10}$/u

/** A Vietnamese phone as `84` followed by nine or ten digits, or null when it is not a plausible number. */
export const toLoyaltyPhone = (raw: MaybeText): MaybeText => {
    const digits = (raw ?? "").replace(/\D/gu, "")
    const national = digits.startsWith("00") ? digits.slice(2) : digits
    const full = national.startsWith("0") ? `84${national.slice(1)}` : national
    const withCountry = !full.startsWith("84") && (full.length === 9 || full.length === 10) ? `84${full}` : full
    return PHONE.test(withCountry) ? withCountry : null
}

/** A lower-case email address, or null when the text is not one. */
export const toLoyaltyEmail = (raw: MaybeText): MaybeText => {
    const value = (raw ?? "").trim().toLowerCase()
    return hasEmailAddressShape(value) ? value : null
}
