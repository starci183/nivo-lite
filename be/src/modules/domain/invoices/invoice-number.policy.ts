/** How many numbers are tried before the invoice is given up. */
export const INVOICE_NUMBER_ATTEMPTS = 4

/** Days between issuing an invoice and its due date. */
export const INVOICE_TERM_DAYS = 15

const SHOP_TIME_ZONE = "Asia/Ho_Chi_Minh"
const DAY_MS = 86_400_000

/** The prefix of the invoice numbers of one month in shop time: `INV-202610-`. */
export const invoicePrefixOf = (now: Date): string => {
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIME_ZONE, year: "numeric", month: "2-digit" })
    return `INV-${month.format(now).replace("-", "")}-`
}

/** The number after the last one of the month (the first when the month has none), moved on by `clashes` after each clash. */
export const nextInvoiceNumber = (prefix: string, last: string | null, clashes: number): string => {
    const count = last === null ? 0 : Number(last.slice(prefix.length)) || 0
    return `${prefix}${String(count + 1 + clashes).padStart(4, "0")}`
}

/** When an invoice issued now falls due. */
export const dueAtOf = (now: Date): Date => new Date(now.getTime() + INVOICE_TERM_DAYS * DAY_MS)
