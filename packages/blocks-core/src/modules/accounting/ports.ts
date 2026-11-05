import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { ListSource } from "@nivo-lite/agent-sdk/block"
import type {
    AdjustmentStore,
    BookEntryStore,
    ClaimStore,
    ConversationFinder,
    Door,
    EntryRow,
    InvoiceStore,
    LeadNames,
    OrderStore,
    Outbox,
    QuestionCounter,
    TransactionStore,
} from "./accounting.types"

/**
 * The ports of the Accounting and payment modules. Each is module-local until CORE-BE lands the engine: the lead swaps the stores
 * for `entityPort(<entity>)` and the outbox and door for the engine ports here, and nothing else changes.
 */

/** The payments (`payment.transaction`). */
export const transactionsPort: PortDefinition<TransactionStore> =
    definePort<TransactionStore>("accounting.transactions")

/** The sales orders (`sales.order`). */
export const ordersPort: PortDefinition<OrderStore> = definePort<OrderStore>("accounting.orders")

/** The customers' payment claims (`payment.claim`). */
export const claimsPort: PortDefinition<ClaimStore> = definePort<ClaimStore>("accounting.claims")

/** The invoices (`accounting.invoice`). */
export const invoicesPort: PortDefinition<InvoiceStore> = definePort<InvoiceStore>("accounting.invoices")

/** The corrections (`accounting.adjustment`). */
export const adjustmentsPort: PortDefinition<AdjustmentStore> = definePort<AdjustmentStore>("accounting.adjustments")

/** The customers' names (`sales.lead`). */
export const leadsPort: PortDefinition<LeadNames> = definePort<LeadNames>("accounting.leads")

/** Where customers wrote (`chat.conversation`). */
export const conversationsPort: PortDefinition<ConversationFinder> =
    definePort<ConversationFinder>("accounting.conversations")

/** The questions that wait for the owner. */
export const questionsPort: PortDefinition<QuestionCounter> = definePort<QuestionCounter>("accounting.questions")

/** The books (`accounting.book-entry`). */
export const bookEntriesPort: PortDefinition<BookEntryStore> = definePort<BookEntryStore>("accounting.book-entries")

/** The list of book entries a list read pages through. */
export const entriesSourcePort: PortDefinition<ListSource<EntryRow>> =
    definePort<ListSource<EntryRow>>("accounting.entries-list")

/** The outbox: declared jobs enqueued in the transaction of the write that causes them. */
export const outboxPort: PortDefinition<Outbox> = definePort<Outbox>("accounting.outbox")

/** The NIVO MCP door, for jobs only. */
export const doorPort: PortDefinition<Door> = definePort<Door>("accounting.door")
