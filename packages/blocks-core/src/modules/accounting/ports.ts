import { entityPort, type EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { definePort, type PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { adjustmentEntity } from "../../entities/accounting/adjustment.entity"
import { accountingQuestionEntity } from "../../entities/accounting/question.entity"
import { accountingSettingsEntity } from "../../entities/accounting/settings.entity"
import { bookEntryEntity } from "../../entities/accounting/book-entry.entity"
import { invoiceEntity } from "../../entities/accounting/invoice.entity"
import { conversationEntity } from "../../entities/chat/conversation.entity"
import { claimEntity } from "../../entities/payment/claim.entity"
import { transactionEntity } from "../../entities/payment/transaction.entity"
import { leadEntity } from "../../entities/sales/lead.entity"
import { orderEntity } from "../../entities/sales/order.entity"
import type { EntryRow } from "./accounting.types"

/*
 * The data of the Accounting and payment modules is the engine's: every row is a record of an entity read and written through its
 * entity port, the outbox and the door are the engine's. Only the list source below is the module's own slot, the id every list read
 * of a module has.
 */

/** The port of the payments (`payment.transaction`). */
export const TRANSACTIONS: PortDefinition<EntityApi> = entityPort(transactionEntity)

/** The port of the sales orders (`sales.order`), the Sales module's entity. */
export const ORDERS: PortDefinition<EntityApi> = entityPort(orderEntity)

/** The port of the customers' payment claims (`payment.claim`). */
export const CLAIMS: PortDefinition<EntityApi> = entityPort(claimEntity)

/** The port of the invoices (`accounting.invoice`). */
export const INVOICES: PortDefinition<EntityApi> = entityPort(invoiceEntity)

/** The port of the corrections (`accounting.adjustment`). */
export const ADJUSTMENTS: PortDefinition<EntityApi> = entityPort(adjustmentEntity)

/** The port of the customers (`sales.lead`), the Sales module's entity. */
export const LEADS: PortDefinition<EntityApi> = entityPort(leadEntity)

/** The port of the conversations (`chat.conversation`), the Chatbot module's entity. */
export const CONVERSATIONS: PortDefinition<EntityApi> = entityPort(conversationEntity)

/** The port of the books (`accounting.book-entry`, a projection written by declared jobs only). */
export const BOOK: PortDefinition<EntityApi> = entityPort(bookEntryEntity)

/** The port of the questions the department asks the owner (`accounting.question`). */
export const QUESTIONS: PortDefinition<EntityApi> = entityPort(accountingQuestionEntity)

/** The port of the workspace's accounting settings (`accounting.settings`, one row). */
export const SETTINGS: PortDefinition<EntityApi> = entityPort(accountingSettingsEntity)

/** The port the entries list runs on: the engine turns a list shape and a query into one query over `accounting.book-entry`. */
export const ENTRIES_LIST: PortDefinition<ListSource<EntryRow>> =
    definePort<ListSource<EntryRow>>("accounting.entries-list")
