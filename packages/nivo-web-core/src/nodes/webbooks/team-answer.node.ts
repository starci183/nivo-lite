import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { webbooksText } from "../../modules/webbooks/copy"
import { CRM_NIVOWEB } from "../../crm/nivoweb/api.generated"
import { TEAM_ANSWER_STAFF_REFUSED, teamAnswerNodeOf } from "../team-answer/team-answer.node"
import { crmAnswered } from "../web-answers"

/** The overdue receivables of the worked example. */
const OVERDUE = {
    items: [
        {
            projectCode: "DA-2025-031",
            customerCode: "KH-0142",
            dueOn: "2026-10-31",
            remainingVnd: 5_500_000,
            lastNoticeOn: "2026-11-05",
        },
    ],
    nextCursor: null,
}

const ANSWER = `Co 1 khoan qua han: du an DA-2025-031 cua KH-0142, con 5.500.000 d, den han 2026-10-31, bao gan nhat 2026-11-05. Nguon: ${CRM_NIVOWEB.get_receivables_overdue}.`

/**
 * `webbooks.team-answer`: the Accounting agent's chat turn, reading the invoices, receivables and payables of the CRM through the shared
 * read-only factory, with the workspace-wide invoices (`CRM_NIVOWEB.get_invoices`) and the purchases still open (`CRM_NIVOWEB.get_purchases_open`). Who may see its figures
 * is the engine's: a staff member's money question reaches the overdue receivables read, which the engine refuses for that standing.
 */
export const webbooksTeamAnswerNode: TemplateNode = teamAnswerNodeOf({
    module: "webbooks",
    title: webbooksText("node.team-answer.title"),
    description: {
        vi: "Tr\u1ea3 l\u1eddi c\u00e2u h\u1ecfi c\u1ee7a \u0111\u1ed9i v\u1ec1 ho\u00e1 \u0111\u01a1n, c\u00f4ng n\u1ee3 ph\u1ea3i thu v\u00e0 ph\u1ea3i tr\u1ea3 b\u1eb1ng s\u1ed1 li\u1ec7u \u0111\u1ecdc t\u1eeb CRM.",
        en: "Answers the team's questions on invoices, receivables and payables from the CRM's own figures.",
    },
    part: "invoices, receivables and payables (the invoices issued, a customer's invoices and balance, invoice drafts, overdue receivables, payables, renewal requests and purchases awaiting payment)",
    reads: [
        CRM_NIVOWEB.get_customers,
        CRM_NIVOWEB.get_customers_code,
        CRM_NIVOWEB.get_customers_code_invoices,
        CRM_NIVOWEB.get_invoices,
        CRM_NIVOWEB.get_invoice_drafts_id,
        CRM_NIVOWEB.get_customers_code_balance,
        CRM_NIVOWEB.get_receivables_overdue,
        CRM_NIVOWEB.get_payables,
        CRM_NIVOWEB.get_renewals_open,
        CRM_NIVOWEB.get_purchases_open,
    ],
    moneyRead: { id: CRM_NIVOWEB.get_receivables_overdue, args: {}, answer: TEAM_ANSWER_STAFF_REFUSED },
    example: {
        name: "answers the owner's question on overdue receivables from the CRM's own list, naming the read",
        question: "Khoan nao dang qua han?",
        reads: [{ id: CRM_NIVOWEB.get_receivables_overdue, args: {}, answer: crmAnswered(OVERDUE) }],
        answer: ANSWER,
    },
})
