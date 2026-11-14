import { entityPort, type EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { definePort, type PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { adjustmentEntity } from "../entities/ledger-adjustment.entity"
import { salesLedgerQuestionEntity } from "../entities/ledger-question.entity"
import { salesLedgerSettingsEntity } from "../entities/ledger-settings.entity"
import { bookEntryEntity } from "../entities/ledger-entry.entity"
import { invoiceEntity } from "../entities/invoice.entity"
import { claimEntity } from "../entities/claim.entity"
import { transactionEntity } from "../entities/transaction.entity"
import { leadEntity } from "../entities/lead.entity"
import { orderEntity } from "../entities/order.entity"
import type { EntryRow } from "./accounting.types"

/*
 * The data of the Accounting and payment modules is the engine's: every row is a record of an entity read and written through its
 * entity port, the outbox and the door are the engine's. Only the list source below is the module's own slot, the id every list read
 * of a module has.
 */

/** The port of the payments (`blocks-core.sales.transaction`). */
export const TRANSACTIONS: PortDefinition<EntityApi> = entityPort(transactionEntity)

/** The port of the sales orders (`blocks-core.sales.order`), the Sales module's entity. */
export const ORDERS: PortDefinition<EntityApi> = entityPort(orderEntity)

/** The port of the customers' payment claims (`blocks-core.sales.claim`). */
export const CLAIMS: PortDefinition<EntityApi> = entityPort(claimEntity)

/** The port of the invoices (`blocks-core.sales.invoice`). */
export const INVOICES: PortDefinition<EntityApi> = entityPort(invoiceEntity)

/** The port of the corrections (`blocks-core.sales.ledger-adjustment`). */
export const ADJUSTMENTS: PortDefinition<EntityApi> = entityPort(adjustmentEntity)

/** The port of the customers (`blocks-core.sales.lead`), the Sales module's entity. */
export const LEADS: PortDefinition<EntityApi> = entityPort(leadEntity)


/** The port of the books (`blocks-core.sales.ledger-entry`, a projection written by declared jobs only). */
export const BOOK: PortDefinition<EntityApi> = entityPort(bookEntryEntity)

/** The port of the questions the department asks the owner (`blocks-core.sales.ledger-question`). */
export const QUESTIONS: PortDefinition<EntityApi> = entityPort(salesLedgerQuestionEntity)

/** The port of the workspace's accounting settings (`blocks-core.sales.ledger-settings`, one row). */
export const SETTINGS: PortDefinition<EntityApi> = entityPort(salesLedgerSettingsEntity)

/** The port the entries list runs on: the engine turns a list shape and a query into one query over `blocks-core.sales.ledger-entry`. */
export const ENTRIES_LIST: PortDefinition<ListSource<EntryRow>> =
    definePort<ListSource<EntryRow>>("sales.entries-list")
