import { z } from "zod"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    callWorkflow,
    defineTemplateGraph,
    equals,
    ifNode,
    node,
    outcome,
    present,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import {
    TEAM_CHAT_TURN_MEMBERS,
    teamAnswerPostNode,
    teamChatInputSchema,
    teamTruthProposeNode,
} from "@nivo-lite/blocks-core"
import { websalesTeamAnswerNode } from "../../../nodes/websales/team-answer.node"
import { websalesTeamRouteNode } from "../../../nodes/websales/team-route.node"

/** The key of the Sales chat turn (`websales.team-chat`, blocks-core's `<module>.team-chat` the router pins). */
export const WEBSALES_TEAM_CHAT_KEY = "websales.team-chat"

/** What the template catalogue shows of `websales.team-chat` version 5: the texts of version 4, the change note of 5 (a declined answer post ends the turn `declined`). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Tr\u1ea3 l\u1eddi \u0111\u1ed9i", en: "Answer the team" },
    summary: {
        vi: "Tr\u1ea3 l\u1eddi ng\u01b0\u1eddi trong \u0111\u1ed9i trong chat ri\u00eang ho\u1eb7c khi \u0111\u01b0\u1ee3c g\u1ecdi t\u00ean trong ph\u00f2ng chung; chuy\u1ec3n y\u00eau c\u1ea7u ch\u1ed1t \u0111\u01a1n hay li\u00ean k\u1ebft kh\u00e1ch sang quy tr\u00ecnh l\u00e0m vi\u1ec7c \u0111\u00f3; \u0111\u1ec1 ngh\u1ecb s\u1eeda Second Brain khi ch\u1ee7 \u0111\u1ed5i m\u1ed9t quy \u0111\u1ecbnh",
        en: "Answers the team's people in the private chat or when called by name in a shared room; hands a request to close a purchase or link a customer to the workflow that does it; proposes a Second Brain change when the owner changes a rule",
    },
    version: 6,
    seedActive: true,
    publishedAt: "2026-11-14T04:15:00.000Z",
    notes: {
        vi: "Nhận tham số của bước gọi trong dữ liệu của sự kiện (trigger.data)",
        en: "Takes its caller's params in the event's data (trigger.data)",
    },
}

/** What a hand-off from the chat turn gives the called workflow: the request the route wrote. */
const HANDED = { text: ref("steps.route.output.request") }

/**
 * `websales.team-chat` version 4 (Tra loi doi): the Sales agent's ONE graph on its team-chat entry (the router's pin, a workflow
 * call). `route` (`websales.team-route`) says what the person asks:
 * - answer: blocks-core's chat turn step for step (decision D3: answer -> propose -> post): `answer` (`websales.team-answer`) reads the
 *   Sales part of the CRM and the truths, `has-proposal` files a truth change (`team.truth-propose`), `post` replies in the room
 *   (`team.answer-post`); a reply a person declined on its card ends `declined` (`post-declined`, no team notice).
 * - close: `to-close` hands the request to `websales.close` (`callWorkflow`), outcome `handed-close`.
 * - link: `to-link` hands it to `websales.link`, outcome `handed-link`.
 * The called workflows post their own results to the team. Change from version 3: the `post-declined` check and the `declined`
 * outcome. Change from version 2: its own graph (it routes first; the close and the
 * link no longer start on a chat line). Never hidden: no step holds an account but the CRM reads of the answer turn.
 */
export const teamChatGraph: TemplateGraph = defineTemplateGraph({
    key: WEBSALES_TEAM_CHAT_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: teamChatInputSchema }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "route",
    nodes: {
        route: node(websalesTeamRouteNode, {
            input: {
                text: ref("trigger.data.text"),
                replyTo: ref("trigger.data.replyTo"),
                lines: ref("trigger.data.lines"),
                locale: ref("trigger.data.locale"),
            },
            routes: { answer: "answer", close: "to-close", link: "to-link" },
        }),
        answer: node(websalesTeamAnswerNode, {
            input: Object.fromEntries(TEAM_CHAT_TURN_MEMBERS.map((name) => [name, ref(`trigger.data.${name}`)])),
            next: "has-proposal",
        }),
        "has-proposal": ifNode({
            when: present(ref("steps.answer.output.proposal")),
            yes: "propose",
            no: "post",
        }),
        propose: node(teamTruthProposeNode, {
            input: {
                room: ref("trigger.data.room"),
                messageId: ref("trigger.data.messageId"),
                proposal: ref("steps.answer.output.proposal"),
            },
            next: "post",
        }),
        post: node(teamAnswerPostNode, {
            input: { messageId: ref("trigger.data.messageId"), answer: ref("steps.answer.output.answer") },
            next: "post-declined",
        }),
        // A posted answer ends the turn as before (no `no`); a reply a person declined on its card ends `declined`.
        "post-declined": ifNode({ when: equals(ref("steps.post.output.declined"), true), yes: "declined" }),
        declined: outcome({ name: "declined" }),
        "to-close": callWorkflow({
            agent: "websales",
            workflow: "close",
            version: "latest",
            input: HANDED,
            next: "handed-close",
        }),
        "handed-close": outcome({ name: "handed-close", output: { request: ref("steps.route.output.request") } }),
        "to-link": callWorkflow({
            agent: "websales",
            workflow: "link",
            version: "latest",
            input: HANDED,
            next: "handed-link",
        }),
        "handed-link": outcome({ name: "handed-link", output: { request: ref("steps.route.output.request") } }),
    },
})
