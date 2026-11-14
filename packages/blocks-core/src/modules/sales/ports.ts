import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { entityPort, type EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { definePort, type PortDefinition } from "@nivo-lite/agent-sdk/port"
import { invoiceEntity } from "../../entities/sales/invoice.entity"
import { claimEntity } from "../../entities/sales/claim.entity"
import { transactionEntity } from "../../entities/sales/transaction.entity"
import { leadEntity } from "../../entities/sales/lead.entity"
import { orderEntity } from "../../entities/sales/order.entity"
import { salesSettingsEntity } from "../../entities/sales/settings.entity"
import type { LeadRow, OrderRow } from "./sales.types"

/*
 * The data of the Sales module is the engine's: the customers and the orders are `blocks-core.sales.lead` and `blocks-core.sales.order` records read and
 * written through their entity ports, and the rights of the member who acts are the platform's. Only the two list sources below
 * are the module's own slots, the id every list read of a module has.
 */

/** The port of the customers (`blocks-core.sales.lead`). */
export const salesLeads: PortDefinition<EntityApi> = entityPort(leadEntity)

/** The port of the orders (`blocks-core.sales.order`). */
export const salesOrders: PortDefinition<EntityApi> = entityPort(orderEntity)

/** The port of the rules the workspace chose for its sales (`blocks-core.sales.settings`, one record). */
export const salesSettings: PortDefinition<EntityApi> = entityPort(salesSettingsEntity)

/** The port of the payments (`blocks-core.sales.transaction`), counted to see whether money is allocated to an order. */
export const salesTransactions: PortDefinition<EntityApi> = entityPort(transactionEntity)

/** The port of the invoices (`blocks-core.sales.invoice`), counted to see whether one was issued for an order. */
export const salesInvoices: PortDefinition<EntityApi> = entityPort(invoiceEntity)

/** The port of the customers' payment claims (`blocks-core.sales.claim`), withdrawn when their order is cancelled. */
export const salesClaims: PortDefinition<EntityApi> = entityPort(claimEntity)

/** The port the leads list runs on. */
export const salesLeadsList: PortDefinition<ListSource<LeadRow>> = definePort<ListSource<LeadRow>>("sales.leads-list")

/** The port the orders list runs on. */
export const salesOrdersList: PortDefinition<ListSource<OrderRow>> =
    definePort<ListSource<OrderRow>>("sales.orders-list")
