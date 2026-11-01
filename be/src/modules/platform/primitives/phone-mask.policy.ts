/**
 * A Vietnamese phone number: a leading 0, or the country code 84 with an optional plus, then 8 to 10 more digits that may be spaced, dotted or dashed.
 * It must not continue a longer number or an amount (`10.000.000`), so a digit, a dot or a comma before it rules the match out.
 */
const PHONE_RUN = /(?<![\d.,])(?:\+84|84|0)(?:[ .-]?\d){8,10}(?!\d)/g

/** The digits kept at each end of a masked number. */
const KEPT_HEAD = 3
const KEPT_TAIL = 3

const maskedOf = (run: string): string => {
    const all = run.replaceAll(/\D/g, "")
    // The country code is the same number as a leading 0.
    const digits = all.startsWith("84") ? `0${all.slice(2)}` : all
    return `${digits.slice(0, KEPT_HEAD)}${"x".repeat(digits.length - KEPT_HEAD - KEPT_TAIL)}${digits.slice(-KEPT_TAIL)}`
}

/**
 * The text with every customer phone number masked (`0912345678` reads `091xxxx678`). A title that anyone on a desk reads is no place for a
 * number: it belongs in the customer record, which keeps it whole.
 */
export const maskPhones = (text: string): string => text.replaceAll(PHONE_RUN, maskedOf)
