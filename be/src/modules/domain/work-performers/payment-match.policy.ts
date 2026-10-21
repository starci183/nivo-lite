import type { ProposalCandidate } from "@modules/domain/work-items"

/** The providers whose bank credits the engine names by bank, keyed by the prefix of the stored event id. */
const BANKS: Readonly<Record<string, string>> = {
    sepay: "SePay",
    casso: "Casso",
    payos: "payOS",
}

/** An issued invoice with the facts a payment is matched on. */
export interface MatchableInvoice {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoiceNo: string
    /** The order number it bills, or null. */
    readonly orderNo: string | null
    /** The customer, or null. */
    readonly leadId: string | null
    /** The customer's name, or null. */
    readonly name: string | null
    /** The amount, VND. */
    readonly amountVnd: number
}

/** The invoices a payment may settle and whether the match is clear. */
export interface PaymentMatch {
    /** The invoices to offer. */
    readonly pool: ReadonlyArray<MatchableInvoice>
    /** True when the transfer content names exactly one invoice and its amount is the payment. */
    readonly clear: boolean
}

const compact = (text: string): string =>
    text
        .normalize("NFKD")
        .toUpperCase()
        .replace(/[^A-Z0-9]/gu, "")

const isDigit = (char: string | undefined): boolean => char !== undefined && /\d/u.test(char)

const mentionsFrom = (text: string, want: string, from: number): boolean => {
    const at = text.indexOf(want, from)
    if (at < 0) return false
    return !isDigit(text[at + want.length]) || mentionsFrom(text, want, at + 1)
}

/**
 * Whether a bank transfer content names this exact code. Banks often drop dashes and spaces ("INV2026090021"), so both are compared
 * without separators; a longer number that merely starts with the code ("...00211") does not count.
 */
export const mentionsCode = (content: string | null | undefined, code: string | null | undefined): boolean => {
    const want = compact(code ?? "")
    return want !== "" && mentionsFrom(compact(content ?? ""), want, 0)
}

/** The bank a stored bank event came from (by its event id prefix), or null for a channel that is not a bank feed. */
export const bankNameOf = (channel: string, eventId: string | null): string | null => {
    if (channel !== "bank" || eventId === null) return null
    const separator = eventId.indexOf(":")
    const provider = separator < 0 ? eventId : eventId.slice(0, separator)
    return BANKS[provider] ?? null
}

/**
 * The invoices to offer for a payment: the ones its content names, else the ones of the same amount, else the newest five. Only a
 * reference that names exactly one invoice of the same amount is clear; an amount-only match needs a human look.
 */
export const matchPayment = (
    issued: ReadonlyArray<MatchableInvoice>,
    content: string,
    amount: number | null,
): PaymentMatch => {
    const byRef = issued.filter(
        (invoice) => mentionsCode(content, invoice.invoiceNo) || mentionsCode(content, invoice.orderNo),
    )
    const byAmount = issued.filter((invoice) => invoice.amountVnd === amount)
    const clear = byRef.length === 1 && byRef[0]?.amountVnd === amount
    if (byRef.length > 0) return { pool: byRef, clear }
    return { pool: byAmount.length > 0 ? byAmount : issued.slice(0, 5), clear }
}

/** The dedupe key prefix of the "customer says they paid" check for one invoice. */
export const claimKeyOf = (invoiceId: string): string => `reconcile_payment:invoice:${invoiceId}`

/** A candidate as the proposal carries it. */
export const candidateOf = (invoice: MatchableInvoice, label: string): ProposalCandidate => ({
    id: invoice.id,
    label,
    amount_vnd: invoice.amountVnd,
})
