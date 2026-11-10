import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { TOOL } from "../../vocabulary/tool-ids"
import { guidanceOf } from "../agent-policy"
import { answerQuestionAction } from "./actions/answer-question.action"
import { adjustAction } from "./actions/adjust.action"
import { decideOwnerItemAction } from "./actions/decide-owner-item.action"
import { resolveUnmatchedPaymentAction } from "./actions/resolve-unmatched-payment.action"
import { saveSettingsAction } from "./actions/save-settings.action"
import { repostLedgerAction } from "./actions/repost-ledger.action"
import { settleAction } from "./actions/settle.action"
import { closeCheckRead } from "./reads/close-check.read"
import { decisionsRead } from "./reads/decisions.read"
import { openOrdersRead } from "./reads/open-orders.read"
import { entriesRead, entryCountsRead, entryStatusCountsRead } from "./reads/entries.read"
import { dueSoonRead } from "./reads/due-soon.read"
import { entryRead } from "./reads/entry.read"
import { figuresRead } from "./reads/figures.read"
import { ledgerRead } from "./reads/ledger.read"
import { settingsRead } from "./reads/settings.read"
import { questionCountRead, questionsRead } from "./reads/questions.read"
import { recentRead } from "./reads/recent.read"
import { ownerQueueRead } from "./reads/owner-queue.read"
import { todayRead } from "./reads/today.read"
import { weeklyRead } from "./reads/weekly.read"
import { accountingSpecDocument } from "./specs/accounting.spec-document"

/**
 * The Accounting module: the books (figures, the entries with search and a kind filter, an entry's lineage), the correction an
 * accountant records, and the check that a period may close. What becomes an entry (expenses, outgoing invoices, unmatched money,
 * voided invoices) is the workspace's own setting, edited in the settings view. Its seed spec draws the workbench; the graph and the jobs run the same
 * reads and actions.
 */
export const accountingModule: ModuleDeclaration = defineModule({
    key: "accounting",
    namespace: "accounting",
    agent: {
        tools: [
            TOOL.paymentClaimRecord,
            TOOL.paymentMarkPaid,
            TOOL.customerMessageSend,
            TOOL.teamMessagePost,
            TOOL.agentTag,
            TOOL.ledgerAppend,
            TOOL.reportDailyClose,
            TOOL.brainChangePropose,
        ],
        abilities: {
            kinds: {
                messaging: { "customer.send": "auto" },
                payment: { "transactions.read": "auto", "credit.rematch": "auto" },
                books: { "ledger.read": "auto", "ledger.write": "auto" },
            },
        },
        policy: {
            limits: { refund: "never" },
            guidance: guidanceOf({
                vi:
                    "Chỉ giao dịch ngân hàng thật mới là bằng chứng khách đã trả; lời khách báo đã chuyển chỉ là lời báo. " +
                    "Một khoản tiền chỉ rõ khi tự nó chỉ đúng một đơn đang chờ (mã đơn trong nội dung) và số tiền bằng đúng số đơn phải trả; " +
                    "mọi trường hợp khác là chưa rõ (số tiền trùng là trùng hợp, lời báo là manh mối): không ghi nhận, không ghi sổ, dừng lại hỏi chủ tiệm kèm dữ kiện, trừ khi quy định của tiệm đã quyết. " +
                    "Mỗi khi dừng hỏi chủ tiệm về tiền của một đơn của khách đã biết, nhắn khách một câu: tiệm đã nhận bao nhiêu cho đơn nào, đang kiểm tra và sẽ báo lại; không nói kết luận chủ tiệm chưa đưa ra. " +
                    "Không tự hoàn tiền, không hứa hoàn.",
                en:
                    "Only a real bank transaction proves a customer paid; a customer's word that they paid is only a claim. " +
                    "Money is clear only when it names one open order by itself (the order code in the transfer content) and its amount equals what that order owes; " +
                    "anything else is not clear (an equal amount is a coincidence, a claim is a lead): settle nothing, book nothing, stop for the founder with the facts, unless the shop's own rule already decides it. " +
                    "Whenever you stop for the founder about money for an order of a known customer, tell that customer one line: what the shop received for which order, that it is checking and will come back; never a verdict the founder has not given. " +
                    "Never refund or promise one.",
            }),
        },
    },
    permissions: ["accounting.view", "accounting.manage"],
    reads: [
        entriesRead,
        entryCountsRead,
        entryStatusCountsRead,
        entryRead,
        figuresRead,
        ledgerRead,
        dueSoonRead,
        weeklyRead,
        decisionsRead,
        ownerQueueRead,
        recentRead,
        todayRead,
        openOrdersRead,
        questionCountRead,
        questionsRead,
        closeCheckRead,
        settingsRead,
    ],
    actions: [
        adjustAction,
        saveSettingsAction,
        answerQuestionAction,
        resolveUnmatchedPaymentAction,
        decideOwnerItemAction,
        repostLedgerAction,
    ],
    tools: ["ledger.status", "ledger.append"],
    specs: [accountingSpecDocument],
})

/**
 * The payment module: `payment.settle`, the transactional action that ties a bank transaction to the order (and the claim) it paid.
 * It has no screen and no read. In the reconcile workflow the settle tool (`TOOL.paymentMarkPaid`) runs it without the notice and the
 * ledger jobs (the workflow writes the ledger and thanks the customer in its own steps); the owner's door action still enqueues
 * `accounting.ledger-append`, `accounting.book-project` and `payment.confirm-notice`. Its words are the Accounting module's.
 */
export const paymentModule: ModuleDeclaration = defineModule({
    key: "payment",
    namespace: "accounting",
    permissions: ["payment.manage"],
    reads: [],
    actions: [settleAction],
    tools: ["chat.send"],
    specs: [],
})
