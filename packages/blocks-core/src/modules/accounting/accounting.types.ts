import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type {
    AdjustmentRecord,
    AdjustmentTarget,
    BookEntryKind,
    BookEntryRecord,
    BookEntryValues,
    ClaimRecord,
    InvoiceRecord,
    OrderRecord,
    OrderStatus,
    TransactionRecord,
} from "../../rules/accounting/accounting.types"
import type { Measure, OpenInvoice } from "../../rules/accounting/figures"
import type { NormalizedAdjustment } from "../../rules/accounting/adjustment"

/*
 * The data this module asks for, as module-local ports. Each mirrors a method of the engine port `entityPort(<entity>)` that CORE-BE
 * delivers (get, insert, update with the version read, list/aggregate), typed with this module's own row types, so the lead swaps a
 * port for the engine one in `ports.ts` alone. A relation (`order`, `lead`) is a record link: the provider joins its id into the row.
 */

/** What a write answers; the same members as the engine's `MutationResult`. */
export type WriteResult<R> =
    | { readonly ok: true; readonly row: R }
    | { readonly ok: false; readonly reason: "taken" | "stale" | "missing" | "invalid" }

/** A range of shop calendar days, `[fromDay, toDay)`, as `YYYY-MM-DD`. */
export interface DayRange {
    /** The first day. */
    readonly fromDay: string
    /** The first day after the range. */
    readonly toDay: string
}

/** A range of instants, `[fromIso, toIso)`. */
export interface InstantRange {
    /** The first instant, ISO text. */
    readonly fromIso: string
    /** The first instant after the range, ISO text. */
    readonly toIso: string
}

/** The payments of the workspace (entity `payment.transaction`). */
export interface TransactionStore {
    /** One transaction, with the id of the order it paid joined in. */
    readonly get: (id: string) => Promise<TransactionRecord | null>
    /** Marks a transaction matched to an order, when its version is still `expected`. */
    readonly settle: (id: string, expected: string, orderId: string) => Promise<WriteResult<TransactionRecord>>
    /** The payments of the range that are unmatched or wait for review. */
    readonly unmatchedIn: (range: InstantRange) => Promise<Measure>
    /** Whether a transaction settled the invoice. */
    readonly settlesInvoice: (invoiceId: string) => Promise<boolean>
}

/** The sales orders (entity `sales.order`). */
export interface OrderStore {
    /** One order, with the id of its lead joined in. */
    readonly get: (id: string) => Promise<OrderRecord | null>
    /** Moves an order to a status, when its version is still `expected`. */
    readonly setStatus: (id: string, expected: string, status: OrderStatus) => Promise<WriteResult<OrderRecord>>
}

/** The customers' payment claims (entity `payment.claim`). */
export interface ClaimStore {
    /** One claim, with the id of its order joined in. */
    readonly get: (id: string) => Promise<ClaimRecord | null>
    /** Marks a claim settled by the transaction that answered it, when its version is still `expected`. */
    readonly settle: (id: string, expected: string, transactionId: string) => Promise<WriteResult<ClaimRecord>>
}

/** The invoices (entity `accounting.invoice`). */
export interface InvoiceStore {
    /** One invoice, with the customer's name joined in. */
    readonly get: (id: string) => Promise<InvoiceRecord | null>
    /** The invoices that are issued and not paid, at most `limit`. */
    readonly open: (limit: number) => Promise<ReadonlyArray<OpenInvoice>>
}

/** The corrections (entity `accounting.adjustment`). */
export interface AdjustmentStore {
    /** One correction. */
    readonly get: (id: string) => Promise<AdjustmentRecord | null>
    /** Whether the record a correction points at exists. */
    readonly targetExists: (type: AdjustmentTarget, id: string) => Promise<boolean>
    /** The corrections that point at a record, oldest first. */
    readonly of: (type: AdjustmentTarget, id: string) => Promise<ReadonlyArray<AdjustmentRecord>>
    /** Writes a correction by the person who asked. */
    readonly insert: (values: NormalizedAdjustment, createdBy: string) => Promise<WriteResult<AdjustmentRecord>>
}

/** The customers' names (entity `sales.lead`). */
export interface LeadNames {
    /** The name of a customer; null when the lead has none or is gone. */
    readonly nameOf: (id: string) => Promise<string | null>
}

/** Where a customer wrote (entity `chat.conversation`). */
export interface ConversationFinder {
    /** The conversation the customer wrote in last; null when they never wrote. */
    readonly latestOfLead: (leadId: string) => Promise<string | null>
}

/** The questions that wait for the owner (work items of the accounting department). */
export interface QuestionCounter {
    /** How many accounting questions wait for the owner. */
    readonly waiting: () => Promise<number>
}

/** The books (entity `accounting.book-entry`, a projection written by declared jobs only). */
export interface BookEntryStore {
    /** One entry. */
    readonly get: (id: string) => Promise<BookEntryRecord | null>
    /** Writes the entry of a source row, or rewrites it: unique by source entity, source id and kind. */
    readonly upsert: (values: BookEntryValues) => Promise<WriteResult<BookEntryRecord>>
    /** The sum of the entries of a range, by kind. */
    readonly totals: (range: DayRange) => Promise<ReadonlyArray<{ kind: BookEntryKind; vnd: number; count: number }>>
}

/** A row of the entries list. */
export interface EntryRow {
    /** The entry id. */
    readonly id: string
    /** What the entry says: its note, or what it came from. */
    readonly title: string
    /** The shop day of the entry, `YYYY-MM-DD`. */
    readonly entryDate: string
    /** What the entry records. */
    readonly kind: BookEntryKind
    /** The amount, in VND. */
    readonly amountVnd: number
}

/** The enqueue options of a declared job. */
export interface EnqueueOptions {
    /** The same key is the same job: a repeated enqueue is a no-op. */
    readonly dedupeKey?: string
}

/** The outbox: enqueues a declared job in the transaction of the write that causes it. */
export interface Outbox {
    /** Enqueues the job `name` with its input. */
    readonly enqueue: (
        name: string,
        input: Readonly<Record<string, JsonValue>>,
        options?: EnqueueOptions,
    ) => Promise<void>
}

/** Why a door call did not return output. */
export type DoorFailure = "unknown_tool" | "invalid" | "forbidden" | "transient" | "failed"

/** What a door call answers. */
export type DoorCallResult =
    | { readonly ok: true; readonly output: JsonValue }
    | { readonly ok: false; readonly reason: DoorFailure; readonly message: string }

/** The NIVO MCP door, for jobs only: a DOMAIN tool name, never a provider name. */
export interface Door {
    /** Calls a tool through the door. */
    readonly call: (tool: string, input: Readonly<Record<string, JsonValue>>) => Promise<DoorCallResult>
}
