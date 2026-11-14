import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { webdeskText } from "../../modules/webdesk/copy"
import { CRM_NIVOWEB } from "../../crm/nivoweb/api.generated"
import { teamAnswerNodeOf } from "../team-answer/team-answer.node"
import { crmAnswered } from "../web-answers"

/** The open tickets of the worked example. */
const OPEN = {
    items: [
        {
            id: "TK-0001",
            customerCode: "KH-0001",
            serviceCodes: [],
            kind: "fault",
            status: "in_progress",
            channel: "zalo",
            sourceRef: null,
            subject: "Web example.vn loi 500 tu sang.",
            openedAt: "2026-11-10T02:00:00.000Z",
            closedAt: null,
        },
    ],
    nextCursor: null,
}

const ANSWER = `Dang co 1 phieu mo: TK-0001 cua KH-0001, web example.vn loi 500, trang thai in_progress. Nguon: ${CRM_NIVOWEB.get_tickets}.`

/**
 * `webdesk.team-answer`: the Support agent's chat turn, reading the tickets and service status of the CRM through the shared read-only
 * factory; the Support team-chat graph files its proposal and posts its answer with the blocks-core steps.
 */
export const webdeskTeamAnswerNode: TemplateNode = teamAnswerNodeOf({
    module: "webdesk",
    title: webdeskText("node.team-answer.title"),
    description: {
        vi: "Tr\u1ea3 l\u1eddi c\u00e2u h\u1ecfi c\u1ee7a \u0111\u1ed9i v\u1ec1 phi\u1ebfu h\u1ed7 tr\u1ee3 v\u00e0 t\u00ecnh tr\u1ea1ng d\u1ecbch v\u1ee5 b\u1eb1ng d\u1eef li\u1ec7u \u0111\u1ecdc t\u1eeb CRM.",
        en: "Answers the team's questions on tickets and service status from the CRM's own data.",
    },
    part: "tickets and the status of a service (a customer, their services, a service's status, tickets)",
    reads: [
        CRM_NIVOWEB.get_customers,
        CRM_NIVOWEB.get_customers_code,
        CRM_NIVOWEB.get_customers_code_services,
        CRM_NIVOWEB.get_services_code_status,
        CRM_NIVOWEB.get_tickets,
        CRM_NIVOWEB.get_tickets_id,
    ],
    example: {
        name: "answers which tickets are open from the CRM's own list, naming the read",
        question: "Dang co phieu nao mo?",
        reads: [{ id: CRM_NIVOWEB.get_tickets, args: { status: "in_progress" }, answer: crmAnswered(OPEN) }],
        answer: ANSWER,
    },
})
