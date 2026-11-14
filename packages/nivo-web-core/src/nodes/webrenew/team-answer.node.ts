import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { webrenewText } from "../../modules/webrenew/copy"
import { CRM_NIVOWEB } from "../../crm/nivoweb/api.generated"
import { teamAnswerNodeOf } from "../team-answer/team-answer.node"
import { crmAnswered } from "../web-answers"

/** The services of the worked example that end within a week. */
const ENDING = {
    items: [
        {
            code: "EXAMPLE-TM",
            customerCode: "KH-001",
            domain: "example.vn",
            serviceClass: "domain",
            provider: "manual",
            status: "active",
            startsOn: "2025-11-19",
            expiresOn: "2026-11-19",
            expirySource: "provider",
            daysLeft: 7,
            reachable: true,
            lastReminderOn: "2026-11-10",
            reminderCount: 2,
            openReminder: false,
            openRenewalId: null,
        },
    ],
    nextCursor: null,
}

const ANSWER = `Tuan nay co 1 dich vu het han: ten mien EXAMPLE-TM (example.vn) cua KH-001, het han 2026-11-19, da nhac 2 lan. Nguon: ${CRM_NIVOWEB.get_services_expiring}.`

/**
 * `webrenew.team-answer`: the Renewal agent's chat turn, reading the services and renewals of the CRM through the shared read-only
 * factory; the Renewal team-chat graph files its proposal and posts its answer with the blocks-core steps.
 */
export const webrenewTeamAnswerNode: TemplateNode = teamAnswerNodeOf({
    module: "webrenew",
    title: webrenewText("node.team-answer.title"),
    description: {
        vi: "Tr\u1ea3 l\u1eddi c\u00e2u h\u1ecfi c\u1ee7a \u0111\u1ed9i v\u1ec1 kh\u00e1ch h\u00e0ng, d\u1ecbch v\u1ee5 s\u1eafp h\u1ebft h\u1ea1n, y\u00eau c\u1ea7u gia h\u1ea1n v\u00e0 b\u1ea3ng gi\u00e1 b\u1eb1ng s\u1ed1 li\u1ec7u \u0111\u1ecdc t\u1eeb CRM.",
        en: "Answers the team's questions on customers, services ending soon, renewal requests and the price list from the CRM's own figures.",
    },
    part: "services and renewals (a customer, their services, the services ending soon, a service's status, renewal requests, the price list)",
    reads: [
        CRM_NIVOWEB.get_customers,
        CRM_NIVOWEB.get_customers_code,
        CRM_NIVOWEB.get_customers_code_services,
        CRM_NIVOWEB.get_services_expiring,
        CRM_NIVOWEB.get_services_code_status,
        CRM_NIVOWEB.get_renewals_open,
        CRM_NIVOWEB.get_renewals_id,
        CRM_NIVOWEB.get_prices,
    ],
    example: {
        name: "answers which services end this week from the CRM's own list, naming the read",
        question: "Dich vu nao het han tuan nay?",
        reads: [{ id: CRM_NIVOWEB.get_services_expiring, args: { withinDays: 7 }, answer: crmAnswered(ENDING) }],
        answer: ANSWER,
    },
})
