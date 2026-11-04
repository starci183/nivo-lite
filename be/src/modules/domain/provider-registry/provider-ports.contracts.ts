import type { IncomingCredit } from "@modules/domain/bank-feed-inbox"
import type { PollFailure, PollLimits, PollPage, PollWindow } from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { BankFeedDeliveryRecorded } from "@modules/queues/bank-feed-delivery"

/** One bank transaction a poller found, ready for the same inbox path a webhook delivery takes. */
export interface PolledCredit {
    /** The connection-scoped delivery key: the same key the provider's webhook uses, so a webhook row and a polled row are one row. */
    readonly deliveryId: string
    /** The credit or debit to book. */
    readonly credit: IncomingCredit
}

/** A bank provider that can read a connection's transactions back. */
export interface BankFeedPoller {
    /** The provider key of the connections it reads. */
    readonly provider: string
    /** The provider identity the inbox stores its rows under: the one its webhook uses. */
    readonly inboxProvider: BankFeedDeliveryRecorded["provider"]
    /** What the provider allows one credential, declared at registration. */
    readonly limits: PollLimits
    /** Reads one page of one connection. */
    fetch(connection: ConnectionRecord, window: PollWindow): Promise<PollPage<PolledCredit>>
    /** Classifies a failure of `fetch` so the scheduler can back off, stop on a bad credential, retry or give up. */
    classify(error: unknown): PollFailure
}

/** What a workspace feed webhook delivery means. */
export type FeedWebhookReading =
    | { readonly kind: "transaction"; readonly credit: IncomingCredit }
    | { readonly kind: "ignored" }
    | { readonly kind: "invalid" }

/** A text that may be absent, such as a header a sender did not present. */
export type OptionalText = string | undefined

/** One parsed delivery body, as the provider sent it. */
export interface DeliveryBody {
    /** A field of the body, whatever the provider sent under it. */
    readonly [field: string]: unknown
}

/** The raw bytes of a delivery, when the transport kept them. */
export type RawDeliveryBody = Buffer | undefined

/** The intake the host runs for one proven delivery. */
export type DeliveryIntake = () => Promise<void>

/** The port of a provider, or undefined when that provider never registered. */
export type OptionalPort<Port> = Port | undefined

/** The transactions of a connection, or undefined when the connection cannot be read yet. */
export type OptionalBankTransactions = ReadonlyArray<BankTransaction> | undefined

/** The provider's reference to a ledger entry, or undefined when the workspace has nothing connected for it. */
export type OptionalLedgerRef = string | undefined

/** A bank provider whose webhook feeds a workspace bank feed: how its key is presented and what a delivery means. */
export interface FeedWebhookPort {
    /** The provider key of the connections it feeds. */
    readonly provider: string
    /** The provider identity the inbox stores its rows under. */
    readonly inboxProvider: BankFeedDeliveryRecorded["provider"]
    /** The key a sender presented in the `Authorization` header, or undefined when none was. */
    keyOf(authorization: OptionalText): OptionalText
    /** Reads one parsed delivery body. */
    read(body: DeliveryBody): FeedWebhookReading
    /** Remembers a delivery whose key was proven, around the intake the host runs for it (the connection page of the provider). */
    traceIntake(connection: string, rawBody: RawDeliveryBody, intake: DeliveryIntake): Promise<void>
    /** Remembers a delivery whose key was refused. */
    traceRefusal(connection: string): Promise<void>
}

/** The bank account a payment instruction is drawn for. */
export interface InstructionAccount {
    /** The full account number. */
    readonly accountNumber: string
    /** The short bank code. */
    readonly bankCode: string
}

/** What a payment instruction is asked for. */
export interface PaymentInstructionRequest {
    /** The order the payment is for. */
    readonly orderNo: string
    /** The amount to pay, in VND. */
    readonly amountVnd: number
    /** The transfer content the payer must write. */
    readonly transferContent: string
}

/** A bank provider that builds the QR a payer scans. */
export interface PaymentInstructionPort {
    /** The provider key of the account it draws for. */
    readonly provider: string
    /** The QR image link for one transfer into the account. */
    qrUrl(account: InstructionAccount, request: PaymentInstructionRequest): string
}

/** What a transaction list is asked for. */
export interface BankTransactionsQuery {
    /** Only transactions at or after this instant; absent reads the default window. */
    readonly since: Date | undefined
    /** Only transactions at or before this instant; absent reads up to now. */
    readonly until: Date | undefined
    /** The most rows. */
    readonly limit: number
}

/** One bank transaction in the bank-feed shape. */
export interface BankTransaction {
    /** The provider-prefixed transaction id, the same as the feed's event id. */
    readonly id: string
    /** Money in or money out. */
    readonly direction: "credit" | "debit"
    /** The amount in VND, always positive. */
    readonly amountVnd: number
    /** The transfer content. */
    readonly content: string
    /** When the bank booked it, ISO 8601. */
    readonly occurredAt: string
    /** The bank name. */
    readonly bankName: string
}

/** A bank provider that lists a connection's transactions. */
export interface BankTransactionsPort {
    /** The provider key of the connections it reads. */
    readonly provider: string
    /** The transactions of one connection, newest first; undefined when the connection cannot be read yet (no API token or account). */
    transactions(connection: ConnectionRecord, query: BankTransactionsQuery): Promise<OptionalBankTransactions>
}

/** A messaging provider whose customer messages can be read back from its inbox to catch what the webhook never delivered. */
export interface MessageInboxPoller<Item = unknown> {
    /** The provider key of the connections it reads. */
    readonly provider: string
    /** What the provider allows one credential, declared at registration. */
    readonly limits: PollLimits
    /** Reads one page of one connection. */
    fetch(connection: ConnectionRecord, window: PollWindow): Promise<PollPage<Item>>
    /** Stores one message through the inbox its webhook feeds, under the webhook's key; false when the webhook already delivered it. */
    store(connection: ConnectionRecord, item: Item): Promise<boolean>
    /** Classifies a failure of `fetch` so the scheduler can back off, stop on a bad credential, retry or give up. */
    classify(error: unknown): PollFailure
}

/** How a ledger entry stands: the payment it records was received, or the entry takes an earlier one back. */
export type LedgerEntryStatus = "paid" | "void"

/** One line of the business ledger in the domain's words; the provider decides where it goes and how it is laid out. */
export interface BusinessLedgerEntry {
    /** The day the money was received, `YYYY-MM-DD`. */
    readonly date: string
    /** The order the payment is for. */
    readonly orderNo: string
    /** The customer. */
    readonly customer: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The bank transaction that paid: the one key of an entry. */
    readonly transactionId: string
    /** Received or taken back. */
    readonly status: LedgerEntryStatus
    /** A free note. */
    readonly note: string
}

/**
 * A provider that keeps the business ledger of a workspace (a Google sheet today; Excel or an accounting tool later). It only ever adds:
 * an entry is never changed or removed, and nothing it holds is read back into a decision. A failure of the provider itself (a timeout, a
 * 5xx, a 429) is thrown as it is and tried again; a refused connection is `PROVIDER_REGISTRY_LEDGER_CONNECTION_REFUSED`.
 */
export interface LedgerPort {
    /** The provider key of the connections it writes through. */
    readonly provider: string
    /** True when the workspace connected this provider and told it where to write. */
    ready(workspaceId: string): Promise<boolean>
    /** Adds one entry and answers the provider's reference to it; undefined when the workspace has nothing connected for it. */
    append(workspaceId: string, entry: BusinessLedgerEntry): Promise<OptionalLedgerRef>
    /** Adds the void entry of a transaction and answers the reference; undefined when the workspace has nothing connected for it. */
    void(workspaceId: string, transactionId: string): Promise<OptionalLedgerRef>
}

/** The port a provider registered, or undefined when none registered under that key. */
export type OptionalProviderPort<Port> = Port | undefined
