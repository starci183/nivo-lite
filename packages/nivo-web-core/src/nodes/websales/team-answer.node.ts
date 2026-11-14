import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { websalesText } from "../../modules/websales/copy"
import { CRM_NIVOWEB } from "../../crm/nivoweb/api.generated"
import { teamAnswerNodeOf } from "../team-answer/team-answer.node"
import { crmAnswered } from "../web-answers"

/** The open purchases of the worked example. */
const OPEN = {
    items: [
        {
            id: "7c1d2e3f-0000-4000-8000-000000000021",
            code: "MUA-7C1D2E3F",
            state: "quoted",
            channel: "zalo",
            sourceRef: "4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c",
            customerCode: null,
            quotedOn: "2026-11-09",
            validUntil: "2026-11-23",
            lastFollowUpOn: null,
            followUpCount: 0,
            openFollowUp: false,
            reachable: true,
        },
    ],
    nextCursor: null,
}

const ANSWER = `Dang co 1 bao gia chua tra loi: MUA-7C1D2E3F, bao gia ngay 2026-11-09, giu den 2026-11-23, chua nhac lan nao. Nguon: ${CRM_NIVOWEB.get_purchases_open}.`

/**
 * `websales.team-answer`: the Sales agent's chat turn, reading the new purchases, their quotes, the price list and the customers of
 * the CRM through the shared read-only factory. It writes nothing to the CRM and posts nothing: the Sales team-chat graph files its
 * proposal and posts its answer with the blocks-core steps.
 */
export const websalesTeamAnswerNode: TemplateNode = teamAnswerNodeOf({
    module: "websales",
    title: websalesText("node.team-answer.title"),
    description: {
        vi: "Tr\u1ea3 l\u1eddi c\u00e2u h\u1ecfi c\u1ee7a \u0111\u1ed9i v\u1ec1 kh\u00e1ch h\u00e0ng m\u1edbi, h\u1ee3p \u0111\u1ed3ng, b\u1ea3ng gi\u00e1 v\u00e0 c\u00e1c \u0111\u01a1n mua \u0111ang m\u1edf b\u1eb1ng s\u1ed1 li\u1ec7u \u0111\u1ecdc t\u1eeb CRM.",
        en: "Answers the team's questions on new customers, contracts, the price list and open purchases from the CRM's own figures.",
    },
    part: "new sales (a customer, their contracts, the price list, the open purchases of new customers and one purchase with its quote)",
    reads: [
        CRM_NIVOWEB.get_customers,
        CRM_NIVOWEB.get_customers_code,
        CRM_NIVOWEB.get_customers_code_contracts,
        CRM_NIVOWEB.get_prices,
        CRM_NIVOWEB.get_purchases_open,
        CRM_NIVOWEB.get_purchases_id,
    ],
    example: {
        name: "answers which quotes are unanswered from the CRM's own list, naming the read",
        question: "Bao gia nao chua tra loi?",
        reads: [{ id: CRM_NIVOWEB.get_purchases_open, args: { state: "quoted" }, answer: crmAnswered(OPEN) }],
        answer: ANSWER,
    },
})
