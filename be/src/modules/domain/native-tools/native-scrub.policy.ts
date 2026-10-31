/** Characters that draw nothing yet travel with text: zero-width marks, direction marks and the tag block, a way to hide words from a reader. */
const HIDDEN = /[​-‏‪-‮⁠-⁤﻿\u{E0000}-\u{E007F}]/gu

/** A run of digits that may hold separators between them, as a phone number, an account or a card is written. */
const DIGIT_RUN = /\+?\d[\d .-]*/gu

/** The characters a run may end with that are punctuation of the sentence around it, not part of the number. */
const SEPARATORS = " .-"

const PHONE_DIGITS = { min: 9, max: 12 } as const
const NUMBER_DIGITS = { plain: 9, spaced: 13, max: 19 } as const

/** True for a token written like an email: something, an at sign, a host with a dot inside it. */
const isEmail = (token: string): boolean => {
    const at = token.indexOf("@")
    const dot = token.indexOf(".", at + 2)
    return at > 0 && dot > at + 1 && dot < token.length - 1
}

/** The label a run of digits earns, or null when it reads as a price, a date or a quantity. */
const labelOf = (core: string): string | null => {
    const digits = core.replaceAll(/\D/gu, "").length
    const separated = [...core].some((char) => SEPARATORS.includes(char))
    if ((core.startsWith("+84") || core.startsWith("0")) && digits >= PHONE_DIGITS.min && digits <= PHONE_DIGITS.max) {
        return "[phone]"
    }
    const plain = !separated && digits >= NUMBER_DIGITS.plain && digits <= NUMBER_DIGITS.max
    return plain || (digits >= NUMBER_DIGITS.spaced && digits <= NUMBER_DIGITS.max) ? "[number]" : null
}

/** A run of digits scrubbed, keeping the separators that trail it. */
const scrubRun = (run: string): string => {
    let end = run.length
    while (end > 0 && SEPARATORS.includes(run.charAt(end - 1))) end -= 1
    const label = labelOf(run.slice(0, end))
    return label === null ? run : `${label}${run.slice(end)}`
}

/** A whitespace-free token scrubbed when it is an email, keeping the punctuation that trails it. */
const scrubToken = (token: string): string => {
    let end = token.length
    while (end > 0 && ".,;:!?)]}\"'".includes(token.charAt(end - 1))) end -= 1
    return isEmail(token.slice(0, end)) ? `[email]${token.slice(end)}` : token
}

/**
 * Text from the business documents as a tool may hand it to a model: hidden characters dropped, and emails, phone numbers and long
 * digit runs (accounts, cards, identity numbers) replaced by a label, since a document may hold a customer's details the agent has
 * no need of. Prices, dates and quantities stay.
 */
export const scrubbed = (text: string): string =>
    text.replaceAll(HIDDEN, "").split(/(\s+)/u).map(scrubToken).join("").replaceAll(DIGIT_RUN, scrubRun)
