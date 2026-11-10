import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { TOOL } from "../../vocabulary/tool-ids"
import { guidanceOf, vndOf } from "../agent-policy"
import { DEFAULT_THRESHOLD_VND } from "../../rules/sales/settings"
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

/** Hours after the payment details went out when the customer is reminded: the default of the policy value `paymentReminderHours`. */
const PAYMENT_REMINDER_HOURS = 2

/** Hours after the payment details went out when an unpaid order is looked at again: the default of `paymentStaleHours`. */
const PAYMENT_STALE_HOURS = 24

/**
 * Whether a confirmed order wins the customer's deal: the default of the policy value `autoWon`, which the shop's own Sales setting of
 * the same name overrides. The order tool moves no deal; the create-order step does, through `lead.stage.update`.
 */
const AUTO_WON = true

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
        tools: [
            TOOL.customerMessageSend,
            TOOL.careSchedule,
            TOOL.leadEnsure,
            TOOL.brainSearch,
            TOOL.leadUpdate,
            TOOL.leadStageUpdate,
            TOOL.orderRecord,
            TOOL.orderConfirm,
            TOOL.paymentQrCreate,
            TOOL.teamMessagePost,
        ],
        abilities: {
            kinds: {
                messaging: { "customer.send": "auto" },
                payment: { "qr.create": "auto" },
            },
        },
        policy: {
            limits: {
                approvalThresholdVnd: DEFAULT_THRESHOLD_VND,
                paymentReminderHours: PAYMENT_REMINDER_HOURS,
                paymentStaleHours: PAYMENT_STALE_HOURS,
                autoWon: AUTO_WON,
            },
            guidance: guidanceOf({
                vi:
                    `Đơn có tổng từ ngưỡng duyệt của tiệm trở lên (mặc định ${vndOf(DEFAULT_THRESHOLD_VND, "vi")}; con số của tiệm là thresholdVnd trong kết quả tạo đơn) cần chủ tiệm duyệt: hỏi chủ tiệm ở /chat trước khi xác nhận đơn. ` +
                    "Giá chỉ lấy từ danh mục, không tự tính tổng, phí hay giảm giá; thanh toán bằng chuyển khoản theo mã QR tiệm gửi. " +
                    "Khi quy trình đang dừng: chỉ nói một câu giữ chỗ, không xác nhận đã nhận tiền, hoàn tiền hay giao hàng.",
                en:
                    `An order whose total reaches the shop's approval threshold (default ${vndOf(DEFAULT_THRESHOLD_VND, "en")}; the shop's own figure is thresholdVnd in the order tool's answer) needs the founder's approval: ask the founder in /chat before confirming it. ` +
                    "Prices come only from the catalogue: never compute a total, a fee or a discount; payment is a bank transfer by the shop's QR. " +
                    "While the workflow is frozen: say one holding line only, never confirm payment, a refund or a delivery.",
            }),
        },
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
