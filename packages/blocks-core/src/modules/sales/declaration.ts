import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { cancelOrderAction } from "./actions/cancel-order.action"
import { decideAction } from "./actions/decide.action"
import { confirmOrderAction } from "./actions/confirm-order.action"
import { moveStageAction } from "./actions/move-stage.action"
import { followAction } from "./actions/follow.action"
import { replyAction } from "./actions/reply.action"
import { respondAction } from "./actions/respond.action"
import { saveSettingsAction } from "./actions/save-settings.action"
import { SALES_PERMISSIONS } from "./constants"
import { awaitingReplyRead } from "./reads/awaiting-reply.read"
import { attentionRead } from "./reads/attention.read"
import { decisionsRead } from "./reads/decisions.read"
import { figuresRead } from "./reads/figures.read"
import { leadRead } from "./reads/lead.read"
import { leadCountsRead, leadsRead } from "./reads/leads.read"
import { orderRead } from "./reads/order.read"
import { orderCountsRead, ordersRead } from "./reads/orders.read"
import { ordersWaitingRead } from "./reads/orders-waiting.read"
import { settingsRead } from "./reads/settings.read"
import { SALES_WORKBENCH_SPEC } from "./specs/sales.workbench"

/** The module key of Sales: every read and action id starts with it. */
export const SALES_MODULE_KEY = "sales"

/**
 * The Sales module: the customers by stage with search and counts, one customer's detail, the orders with the owner's wait, and
 * the actions that move a deal and confirm or cancel an order. The rules (the owner threshold, when a draft waits, whether a closed
 * deal may flip or reopen) are the workspace's own settings, edited in the settings view. The seed spec draws it from the generic blocks.
 */
export const salesModule: ModuleDeclaration = defineModule({
    key: SALES_MODULE_KEY,
    namespace: "sales",
    permissions: SALES_PERMISSIONS,
    reads: [
        leadsRead,
        leadCountsRead,
        leadRead,
        ordersRead,
        orderCountsRead,
        orderRead,
        ordersWaitingRead,
        settingsRead,
        figuresRead,
        attentionRead,
        decisionsRead,
        awaitingReplyRead,
    ],
    actions: [
        moveStageAction,
        confirmOrderAction,
        cancelOrderAction,
        saveSettingsAction,
        decideAction,
        respondAction,
        followAction,
        replyAction,
    ],
    specs: [SALES_WORKBENCH_SPEC],
})
