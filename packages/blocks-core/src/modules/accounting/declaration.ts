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
        ],
        abilities: {
            kinds: {
                messaging: { "customer.send": "auto" },
                payment: { "transactions.read": "auto", "credit.rematch": "auto" },
                books: { "ledger.read": "auto", "ledger.write": "auto" },
            },
        },
        policy: {
            limits: { overpayment: "settle", underpayment: "ask", refund: "never" },
            guidance: guidanceOf({
                vi:
                    "Chỉ giao dịch ngân hàng thật mới là bằng chứng khách đã trả; lời khách báo đã chuyển chỉ là lời báo. " +
                    "Khách chuyển dư: vẫn ghi nhận đã trả (sổ ghi đúng số thật nhận) và báo đội phần dư; không tự hoàn tiền, không hứa hoàn. " +
                    "Khách chuyển thiếu: theo quy định của tiệm nếu có (đặt cọc, giảm cho khách quen…); chưa có quy định thì hỏi chủ tiệm ở /chat trước khi ghi nhận đã trả. " +
                    "Tiền vào không thuộc đơn nào: không gán bừa, hỏi chủ tiệm.",
                en:
                    "Only a real bank transaction proves a customer paid; a customer's word that they paid is only a claim. " +
                    "A customer paid more: still mark the order paid (the books keep what really arrived) and tell the team the extra; never refund or promise one. " +
                    "A customer paid less: follow the shop's rule when it has one (a deposit, a discount for a regular customer…); with no rule ask the founder in /chat before marking the order paid. " +
                    "Money that pays no order: never force a match, ask the founder.",
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
