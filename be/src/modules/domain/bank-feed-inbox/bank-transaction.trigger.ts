import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"
import type { OptionalCanonicalEvent, TriggerDeclaration } from "@modules/domain/provider-triggers"

/*
 * THE BANK FEEDS' TRANSACTION TRIGGER (stage 1 of the one event pipeline, concept triggers rule 13): one movement of a bank account, as
 * every bank feed (SePay, Casso, payOS) reports it, as ONE canonical event per movement. Its raw is the `<provider>.transaction` row the
 * feed's intake kept (one shape for the three feeds, keyed by the provider's own transaction id: a webhook delivery and the reconcile poll
 * of the same movement are one row). Pure: the translate reads only its argument. A credit is the movement IN: the engine derives
 * `payment.credit.received` registrations with `data.direction = in` (trigger-specs `CREDITS_ONLY`), so the trigger keeps both directions,
 * as before.
 */

/** The trigger's name inside each bank feed. */
export const BANK_TRANSACTION_RECEIVED = "transaction.received"

/** The data of one movement: the provider's id of it, its direction, and the facts every feed's row holds (absent when the row lacks one). */
export type BankTransactionData = {
    /** The provider's own id of the movement (the row's key). */
    readonly transactionId: string
    /** Money in or out. */
    readonly direction: "in" | "out"
    /** The amount in VND, a whole number. */
    readonly amountVnd: number
    /** The transfer content the bank shows. */
    readonly content: string
    /** When the bank booked it (ISO 8601), when the feed says. */
    readonly at?: string | undefined
    /** The bank account it moved on, when the feed names it. */
    readonly account?: string | undefined
    /** The bank's own reference, when the feed gives one. */
    readonly bankRef?: string | undefined
}

/** The `<provider>.transaction` row value (bank-feed.data-types.ts `transactionOf`). The translate's raw. */
export interface BankTransactionRow {
    /** The provider's own id of the movement (the row's key); empty when the feed gave none. */
    readonly transactionId: string
    /** The amount of the movement in VND. */
    readonly amount: number
    /** The feed's direction word; `debit` is money out, anything else is money in. */
    readonly direction: string
    /** The transfer content the bank shows. */
    readonly content: string
    /** The bank account it moved on, when the feed names it. */
    readonly account?: string | undefined
    /** The counterparty that sent the money, when the feed names it. */
    readonly payer?: string | undefined
    /** The bank's own reference, when the feed gives one. */
    readonly bankRef?: string | undefined
    /** When the bank booked it (ISO 8601), when the feed says. */
    readonly at?: string | undefined
    /** The feed that reported the movement (its provider name). */
    readonly source: string
}

/** The translate: the movement of one stored row; null for a row with no id. */
export const translateBankTransactionRow = (row: BankTransactionRow): OptionalCanonicalEvent<BankTransactionData> => {
    if (row.transactionId === "") return null
    return {
        id: row.transactionId,
        data: {
            transactionId: row.transactionId,
            direction: row.direction === "debit" ? "out" : "in",
            amountVnd: row.amount,
            content: row.content,
            ...(row.at === undefined ? {} : { at: row.at }),
            ...(row.account === undefined ? {} : { account: row.account }),
            ...(row.bankRef === undefined ? {} : { bankRef: row.bankRef }),
        },
    }
}

/** The bounds the stored `<provider>.transaction` row holds (bank-feed.data-types.ts `transactionOf`): the schemas below accept what the row can hold. */
const ID_MAX = 400
const CONTENT_MAX = 2000
const DIRECTION_MAX = 6
const ACCOUNT_MAX = 64
const PAYER_MAX = 256
const SOURCE_MAX = 8
/** An ISO 8601 timestamp is far shorter. */
const AT_MAX = 64

/** The data schema of one movement. */
const BANK_TRANSACTION_DATA: z.ZodType<BankTransactionData> = z.object({
    transactionId: z.string().min(1).max(ID_MAX),
    direction: z.enum(["in", "out"]),
    amountVnd: z.number().int(),
    content: z.string().max(CONTENT_MAX),
    at: z.string().max(AT_MAX).optional(),
    account: z.string().max(ACCOUNT_MAX).optional(),
    bankRef: z.string().max(ID_MAX).optional(),
})

/** The raw schema: the stored transaction row value. */
const BANK_TRANSACTION_ROW: z.ZodType<BankTransactionRow> = z.object({
    transactionId: z.string().max(ID_MAX),
    amount: z.number(),
    direction: z.string().max(DIRECTION_MAX),
    content: z.string().max(CONTENT_MAX),
    account: z.string().max(ACCOUNT_MAX).optional(),
    payer: z.string().max(PAYER_MAX).optional(),
    bankRef: z.string().max(ID_MAX).optional(),
    at: z.string().max(AT_MAX).optional(),
    source: z.string().max(SOURCE_MAX),
})

/** The bank feeds that report a movement as this trigger. */
export const BANK_TRANSACTION_PROVIDERS: ReadonlyArray<string> = [PROVIDER.sepay, PROVIDER.casso, PROVIDER.payos]

/** One feed's transaction trigger: received by its webhook (its poll reconciles into the same row), keyed by the transaction. */
const bankTransactionTriggerOf = (provider: string): TriggerDeclaration<BankTransactionRow, BankTransactionData> => ({
    provider,
    name: BANK_TRANSACTION_RECEIVED,
    verb: TRIGGER.paymentCreditReceived,
    via: "webhook",
    raw: BANK_TRANSACTION_ROW,
    data: BANK_TRANSACTION_DATA,
    translate: translateBankTransactionRow,
    key: { by: "data", member: "transactionId" },
    settle: null,
})

/** Every bank feed's transaction trigger. */
export const BANK_TRANSACTION_TRIGGERS: ReadonlyArray<TriggerDeclaration<BankTransactionRow, BankTransactionData>> =
    BANK_TRANSACTION_PROVIDERS.map((provider) => bankTransactionTriggerOf(provider))

/** The transaction trigger of one bank feed, or null for a provider that is no bank feed. */
export const bankTransactionTriggerFor = (
    provider: string,
): TriggerDeclaration<BankTransactionRow, BankTransactionData> | null =>
    BANK_TRANSACTION_TRIGGERS.find((declaration) => declaration.provider === provider) ?? null
