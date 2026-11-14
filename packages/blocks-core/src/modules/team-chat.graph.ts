import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    type TemplateNode,
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
    TEAM_CHAT_LINES_MAX,
    TEAM_CHAT_LINE_MAX,
    TEAM_CHAT_TEXT_MAX,
    TEAM_CHAT_WORKFLOW_KEY,
    type TeamChatInput,
    type TeamChatLine,
} from "@nivo-lite/agent-sdk/team-chat"
import { z } from "zod"
import { bilingualOf } from "../messages/catalog"
import { MAX_ID, MAX_LINE } from "../bounds"
import { teamAnswerPostNode } from "../nodes/team/answer-post.node"
import { teamChatNode } from "../nodes/team/team-chat.node"
import { teamTruthProposeNode } from "../nodes/team/truth-propose.node"

export { TEAM_CHAT_WORKFLOW_KEY }

/**
 * What the template catalogue shows of a module's chat turn ("Answer the team"); a business wake never routes to it (primary
 * only for an agent with no business graph: Accounting); `seedActive`: a seed or re-seed adds it to the agent ACTIVE (a chat turn the team
 * cannot reach answers no one).
 */
const TEAM_CHAT_CATALOGUE: TemplateCatalogue = {
    name: bilingualOf("teamChatTemplateName"),
    summary: bilingualOf("teamChatTemplateSummary"),
    version: 7,
    publishedAt: "2026-11-14T04:15:00.000Z",
    seedActive: true,
    notes: {
        vi: "Nhận tham số của bước gọi trong dữ liệu của sự kiện (trigger.data)",
        en: "Takes its caller's params in the event's data (trigger.data)",
    },
}

/** The blocks-core modules whose agent answers the team: every blocks-core module that declares an agent. */
export const TEAM_CHAT_MODULES: ReadonlyArray<string> = ["sales", "chatbot"]

/**
 * What the team-chat router supplies through its workflow call: a chat turn's input, `replyTo` alone may be absent. The one contract of
 * every `<module>.team-chat` graph, exported so a plugin's own team-chat graph declares the same one.
 */
export type TeamChatCall = Omit<TeamChatInput, "replyTo"> & {
    /** The line this one answers; absent or null when it answers none. */
    readonly replyTo?: TeamChatLine | null | undefined
}

/** One room line as the router supplies it. */
export const teamChatLineSchema: z.ZodType<TeamChatLine> = z.object({
    id: z.string().min(1).max(MAX_ID),
    by: z.enum(["person", "agent", "system"]),
    name: z.string().max(MAX_LINE),
    text: z.string().max(TEAM_CHAT_LINE_MAX),
    at: z.string().max(MAX_ID),
})

/** The graph's contract: what the team-chat router supplies through its workflow call (`replyTo` alone may be absent). */
export const teamChatInputSchema: z.ZodType<TeamChatCall> = z.object({
    roomId: z.string().min(1).max(MAX_ID),
    messageId: z.string().min(1).max(MAX_ID),
    text: z.string().min(1).max(TEAM_CHAT_TEXT_MAX),
    room: z.enum(["direct", "common"]),
    intent: z.enum(["answer", "capture"]),
    asker: z.object({ name: z.string().max(MAX_LINE), standing: z.enum(["owner", "manager", "staff"]) }),
    lines: z.array(teamChatLineSchema).max(TEAM_CHAT_LINES_MAX),
    replyTo: teamChatLineSchema.nullish(),
    locale: z.enum(["vi", "en"]),
})

/** A member of the router's call. */
export type TeamChatTurnMember = keyof TeamChatCall

/** The members of the router's call every answer turn reads, bound one to one from the trigger. */
export const TEAM_CHAT_TURN_MEMBERS: ReadonlyArray<TeamChatTurnMember> = [
    "roomId",
    "messageId",
    "text",
    "room",
    "intent",
    "asker",
    "lines",
    "replyTo",
    "locale",
]

/**
 * An answer turn this graph can wrap: a node that reads the router's chat turn and outputs `{ answer, proposal | null }`. `team.chat`
 * for the blocks-core modules; a plugin passes its own `<module>.team-answer` (same input, same output), so the propose and post steps
 * are the same two nodes everywhere. The output shape is proven at save by the refs below (`GRAPH_REF_TYPE`), not by this type.
 */
export type TeamAnswerTurn = TemplateNode

/**
 * The graph of a module's chat turn: the answer turn reads and writes (`answer`), a truth change is filed only when the
 * turn wrote one (`has-proposal` -> `propose`), then the answer is posted as a reply (`post`); a post a person declined on its card
 * ends the turn with the outcome `declined` (`post-declined`, no team notice: the person who declined is the team). Order answer -> propose -> post (decision
 * D3): the answer's words never depend on the filing's result. Reached only by the router's pin: its one trigger is a workflow call,
 * so no business wake ever lands on it. No step holds an account: every tool is NIVO's own. `propose` takes the proposal that may be
 * null (the `ifNode` does not narrow the ref) and files nothing then. `catalogue` is the catalogue row the graph carries: a plugin module
 * passes its own (its name, version and notes); absent, blocks-core's.
 */
export const teamChatGraphOf = (
    moduleKey: string,
    answerTurn: TeamAnswerTurn = teamChatNode,
    catalogue: TemplateCatalogue = TEAM_CHAT_CATALOGUE,
): TemplateGraph =>
    defineTemplateGraph({
        key: `${moduleKey}.${TEAM_CHAT_WORKFLOW_KEY}`,
        title: bilingualOf("teamChatTemplateName"),
        input: z.object({ data: teamChatInputSchema }),
        triggers: [trigger(TRIGGER.workflowCalled)],
        openTo: "any",
        start: "answer",
        nodes: {
            answer: node(answerTurn, {
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
            // A posted answer ends the turn as before (no `no`); a post a person declined on its card ends `declined`.
            "post-declined": ifNode({ when: equals(ref("steps.post.output.declined"), true), yes: "declined" }),
            declined: outcome({ name: "declined" }),
        },
        catalogue,
    })

/** The chat-turn graph of every blocks-core module with an agent, by module key. */
export const TEAM_CHAT_GRAPHS: Readonly<Record<string, TemplateGraph>> = Object.fromEntries(
    TEAM_CHAT_MODULES.map((moduleKey) => [moduleKey, teamChatGraphOf(moduleKey)]),
)
