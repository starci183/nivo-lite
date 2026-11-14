import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { TOOL } from "@nivo-lite/agent-sdk/names"
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
import { LOYALTY_ACTIONS, LOYALTY_READS } from "./loyalty/declaration"
import { LEDGER_ACTIONS, LEDGER_AGENT_TOOLS, LEDGER_READS, LEDGER_TOOLS } from "./ledger/declaration"
import { SALES_WORKBENCH_SPEC } from "./specs/sales.workbench"

/** The tools the Sales steps call, before the ledger's are added (the ledger adds only those it does not share). */
const OWN_AGENT_TOOLS: ReadonlyArray<string> = [
    TOOL.customerMessageSend,
    TOOL.leadCareGet,
    TOOL.contactMemoryRemember,
    TOOL.leadOrderList,
    TOOL.orderGet,
    TOOL.teamMessagePost,
    // The money in: the one bank movement the trigger names (any of the three feeds), and the transfer QR of an order.
    TOOL.paymentCreditGet,
    TOOL.paymentTransferCreate,
    TOOL.brainChangePropose,
]

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
    agent: {
        // The tools of EVERY Sales node, consult (slice B) and care (slice C) merged at consolidation 2026-11-12, and the truth reads its
        // agents may make. The kinds/abilities table that stood here goes: the node `accounts` (providers in order, a mode per tool) are
        // the whole reach (contract C1/C3).
        tools: [
            ...OWN_AGENT_TOOLS,
            // The books of the sale (the ledger area), each tool once.
            ...LEDGER_AGENT_TOOLS.filter((tool) => !OWN_AGENT_TOOLS.includes(tool)),
        ],
    },
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
        ...LEDGER_READS,
        ...LOYALTY_READS,
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
        ...LEDGER_ACTIONS,
        ...LOYALTY_ACTIONS,
    ],
    tools: [...LEDGER_TOOLS],
    specs: [SALES_WORKBENCH_SPEC],
})
