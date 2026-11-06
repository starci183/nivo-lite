import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { entityPort } from "@nivo-lite/agent-sdk/entity/port"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { leadEntity } from "../../entities/sales/lead.entity"
import { orderEntity } from "../../entities/sales/order.entity"
import { settingsEntity } from "../../entities/sales/settings.entity"
import type { LeadRow, OrderRow } from "./sales.types"

/*
 * The data of the Sales module is the engine's: the customers and the orders are `sales.lead` and `sales.order` records read and
 * written through their entity ports, and the rights of the member who acts are the platform's. Only the two list sources below
 * are the module's own slots, the id every list read of a module has.
 */

/** The port of the customers (`sales.lead`). */
export const salesLeads: PortDefinition<EntityApi> = entityPort(leadEntity)

/** The port of the orders (`sales.order`). */
export const salesOrders: PortDefinition<EntityApi> = entityPort(orderEntity)

/** The port of the rules the workspace chose for its sales (`sales.settings`, one record). */
export const salesSettings: PortDefinition<EntityApi> = entityPort(settingsEntity)

/** The port the leads list runs on. */
export const salesLeadsList: PortDefinition<ListSource<LeadRow>> = definePort<ListSource<LeadRow>>("sales.leads-list")

/** The port the orders list runs on. */
export const salesOrdersList: PortDefinition<ListSource<OrderRow>> =
    definePort<ListSource<OrderRow>>("sales.orders-list")
