import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { cancelOrderAction } from "./actions/cancel-order.action"
import { confirmOrderAction } from "./actions/confirm-order.action"
import { moveStageAction } from "./actions/move-stage.action"
import { SALES_PERMISSIONS } from "./constants"
import { leadRead } from "./reads/lead.read"
import { leadCountsRead, leadsRead } from "./reads/leads.read"
import { orderRead } from "./reads/order.read"
import { orderCountsRead, ordersRead } from "./reads/orders.read"
import { ordersWaitingRead } from "./reads/orders-waiting.read"
import { SALES_WORKBENCH_SPEC } from "./specs/sales.workbench"

/** The module key of Sales: every read and action id starts with it. */
export const SALES_MODULE_KEY = "sales"

/**
 * The Sales module: the customers by stage with search and counts, one customer's detail, the orders with the owner's wait, and
 * the actions that move a deal and confirm or cancel an order. The seed spec draws it from the generic blocks.
 */
export const salesModule: ModuleDeclaration = defineModule({
    key: SALES_MODULE_KEY,
    namespace: "sales",
    permissions: SALES_PERMISSIONS,
    reads: [leadsRead, leadCountsRead, leadRead, ordersRead, orderCountsRead, orderRead, ordersWaitingRead],
    actions: [moveStageAction, confirmOrderAction, cancelOrderAction],
    specs: [SALES_WORKBENCH_SPEC],
})
