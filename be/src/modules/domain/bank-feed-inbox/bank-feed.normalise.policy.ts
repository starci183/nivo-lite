import type { AccountDataInput, AccountDataTypeDef } from "@modules/domain/account-data"
import { isRecord } from "@modules/platform/primitives"
import type { BankFeedProvider, FeedReceiptPayload, IncomingCredit } from "./bank-feed-inbox.contracts"
import {
    cassoDelivery,
    cassoTransaction,
    payosDelivery,
    payosTransaction,
    sepayDelivery,
    sepayTransaction,
} from "./bank-feed.data-types"

/** The two types a bank door writes: its deliveries and the movements they report. */
interface BankFeedTypes {
    /** The consumer's work row of a delivery. */
    readonly delivery: AccountDataTypeDef
    /** One bank movement as the provider reported it. */
    readonly transaction: AccountDataTypeDef
}

/** The types each bank door writes, by the door's claim name. */
const TYPES_OF_DOOR: Readonly<Record<BankFeedProvider, BankFeedTypes>> = {
    "sepay-feed": { delivery: sepayDelivery, transaction: sepayTransaction },
    casso: { delivery: cassoDelivery, transaction: cassoTransaction },
    payos: { delivery: payosDelivery, transaction: payosTransaction },
}

/** The type name of a bank door's deliveries (`sepay.delivery`, `casso.delivery`, `payos.delivery`). */
export const deliveryTypeOf = (door: BankFeedProvider): string => TYPES_OF_DOOR[door].delivery.name

/** A text member of a stored credit, or undefined when it is absent or not text. */
const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

/** One stored credit read back member by member; null when it lacks what the consumer needs. */
const creditOf = (stored: unknown): IncomingCredit | null => {
    if (!isRecord(stored)) return null
    const { amount, content, eventId, fallbackBankName } = stored
    if (typeof amount !== "number" || typeof content !== "string") return null
    if (typeof eventId !== "string" || typeof fallbackBankName !== "string") return null
    const account = textOf(stored.account)
    const payer = textOf(stored.payer)
    const occurredAt = textOf(stored.occurredAt)
    const bankRef = textOf(stored.bankRef)
    return {
        amount,
        content,
        eventId,
        fallbackBankName,
        ...(stored.direction === "debit" ? { direction: "debit" } : {}),
        ...(account === undefined ? {} : { account }),
        ...(payer === undefined ? {} : { payer }),
        ...(occurredAt === undefined ? {} : { occurredAt }),
        ...(bankRef === undefined ? {} : { bankRef }),
    }
}

/** The credits of a receipt as JSON holds them: each with only the members it has (an absent member is no `undefined`). */
const storedCreditsOf = (credits: ReadonlyArray<IncomingCredit>): ReadonlyArray<IncomingCredit> =>
    credits.map((credit) => creditOf(credit)).filter((credit): credit is IncomingCredit => credit !== null)

/** The delivery row of a receipt, keyed by the delivery id without its `<connection>:` prefix; the connection is the account itself. */
export const feedDeliveryRowsOf = (
    door: BankFeedProvider,
    deliveryKey: string,
    receipt: FeedReceiptPayload,
): ReadonlyArray<AccountDataInput> => [
    {
        type: deliveryTypeOf(door),
        value: {
            deliveryId: deliveryKey,
            credits: storedCreditsOf(receipt.credits),
            ...(receipt.source === undefined ? {} : { source: receipt.source }),
        },
    },
]

/** The receipt a delivery row holds, in the shape the consumer reads; a stored credit that cannot be read is left out. */
export const feedReceiptOf = (connection: string, value: Readonly<Record<string, unknown>>): FeedReceiptPayload => {
    const stored: ReadonlyArray<unknown> = Array.isArray(value.credits) ? value.credits : []
    const credits = stored.map((credit) => creditOf(credit))
    return {
        connection,
        credits: credits.filter((credit): credit is IncomingCredit => credit !== null),
        ...(value.source === "poll" ? { source: "poll" } : {}),
    }
}

/** When the bank booked a movement, as ISO text, when the provider says a valid time. */
const atOf = (credit: IncomingCredit): string | undefined => {
    if (credit.occurredAt === undefined) return undefined
    const at = new Date(credit.occurredAt)
    return Number.isNaN(at.getTime()) ? undefined : at.toISOString()
}

/** The transaction rows of a receipt's credits and debits, one per movement, keyed by the provider's own transaction id. */
export const feedTransactionRowsOf = (
    door: BankFeedProvider,
    receipt: FeedReceiptPayload,
): ReadonlyArray<AccountDataInput> =>
    receipt.credits.map((credit) => {
        const at = atOf(credit)
        return {
            type: TYPES_OF_DOOR[door].transaction.name,
            value: {
                transactionId: credit.eventId,
                amount: Math.round(credit.amount),
                direction: credit.direction === "debit" ? "debit" : "credit",
                content: credit.content,
                ...(credit.account === undefined ? {} : { account: credit.account }),
                ...(credit.payer === undefined ? {} : { payer: credit.payer }),
                ...(credit.bankRef === undefined ? {} : { bankRef: credit.bankRef }),
                ...(at === undefined ? {} : { at }),
                source: receipt.source === "poll" ? "poll" : "webhook",
            },
        }
    })
