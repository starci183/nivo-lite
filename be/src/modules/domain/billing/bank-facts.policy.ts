/** The shape a feed writes a booking time in when it names no zone: date and time, Vietnam time. */
const VIETNAM_TIME = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/u

/** An ISO date-time that names its zone (`Z` or `±hh:mm`): read as it is. */
const ZONED_ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u

/** The facts of a bank movement a feed passes on: the bank's reference, the account number and the booking time, each when given. */
export interface BankFacts {
    /** The bank's own reference of the movement, when the feed passes it on. */
    readonly bankRef?: string
    /** The bank account number the movement belongs to, when the feed says. */
    readonly account?: string
    /** When the bank booked the movement, ISO text, when the feed says it readably. */
    readonly occurredAt?: string
}

/** A member as non-empty text with its spaces trimmed (a finite number counts as its digits); undefined otherwise. */
export const bankTextOf = (value: unknown): string | undefined => {
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined
    const text = typeof value === "string" ? value.trim() : ""
    return text === "" ? undefined : text
}

/**
 * A feed's booking time as ISO text: a zone-less `YYYY-MM-DD HH:mm:ss` is Vietnam time (+07:00), read exactly as SePay's; an ISO text
 * that names its zone is read as it is; anything else, or an impossible date, is undefined.
 */
export const bankTimeOf = (value: unknown): string | undefined => {
    const text = bankTextOf(value)
    if (text === undefined || typeof value !== "string") return undefined
    let moment = Number.NaN
    if (VIETNAM_TIME.test(text)) moment = Date.parse(text.replace(VIETNAM_TIME, "$1T$2+07:00"))
    else if (ZONED_ISO_TIME.test(text)) moment = Date.parse(text)
    return Number.isNaN(moment) ? undefined : new Date(moment).toISOString()
}

/** The bank facts as optional members: a fact that is absent adds no member, so a sparse delivery reads exactly as before. */
export const bankFactsOf = (bankRef: unknown, account: unknown, occurredAt: unknown): BankFacts => {
    const reference = bankTextOf(bankRef)
    const number = bankTextOf(account)
    const time = bankTimeOf(occurredAt)
    return {
        ...(reference === undefined ? {} : { bankRef: reference }),
        ...(number === undefined ? {} : { account: number }),
        ...(time === undefined ? {} : { occurredAt: time }),
    }
}

/** The bank facts a feed's reading carries, copied member by member: an absent fact stays absent on the credit. */
export const bankFactsOfCredit = (facts: BankFacts): BankFacts => ({
    ...(facts.bankRef === undefined ? {} : { bankRef: facts.bankRef }),
    ...(facts.account === undefined ? {} : { account: facts.account }),
    ...(facts.occurredAt === undefined ? {} : { occurredAt: facts.occurredAt }),
})
