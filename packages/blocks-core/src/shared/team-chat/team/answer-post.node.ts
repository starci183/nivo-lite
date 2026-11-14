import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf, sampleOf } from "../../messages/catalog"
import type { NodeSchema } from "../../nodes/node-schema.types"
import { answered, refused, valueOrCannot } from "../../nodes/tool-answers"
import { TEAM_CHAT_ASKED } from "./team-chat.node"
import { TEAM_CHAT_ANSWER_MAX } from "./team-chat.policy"

type NoParams = Record<string, never>

/** What is posted: the answer, and the person's message it replies to. */
export interface AnswerPostInput {
    /** The person's message the answer replies to; the room is the message's own. */
    readonly messageId: string
    /** The words of the answer. */
    readonly answer: string
}

/** That the answer was posted, or that a person declined the post on its card. */
export interface AnswerPostOutput {
    /** True once the answer is in the room. */
    readonly posted: boolean
    /** True when a person declined the post on its card: nothing was posted (the graph ends `declined`). */
    readonly declined: boolean
}

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<AnswerPostInput> = z.object({
    messageId: z.string().min(1).max(MAX_ID),
    answer: z.string().min(1).max(TEAM_CHAT_ANSWER_MAX),
})
const output: NodeSchema<AnswerPostOutput> = z.object({
    posted: z.boolean().describe("True once the answer is in the room."),
    declined: z.boolean().describe("True when a person declined the post on its card: nothing was posted."),
})

/** The post of an example: the answer as a reply to the asked message. */
const replyPost = (text: string): Readonly<Record<string, string>> => ({
    kind: "chat.answer",
    messageId: TEAM_CHAT_ASKED,
    text,
})

/** What the post tool answers for a reply: the chat message it wrote, in the asked message's room (the effect's facts as `value`, not read). */
const postedAs = (id: string): JsonObject => ({
    messageId: id,
    roomId: "6f1c2a10-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
    replyTo: TEAM_CHAT_ASKED,
})

/**
 * `team.answer-post` (post the answer in the room): one call of `nivo.tool.team.message.post` that puts an answer turn's words in the
 * room of the person's message, as a reply to it. No AI call, no key: the engine posts one answer per message and agent (the tool's
 * business key, contract C4.2). Generic: `team.chat` and the four plugin `<module>.team-answer` turns all hand it `{ messageId, answer }`.
 * It is the purpose of the team-chat graph, so a refused post fails the step (the engine reports it); a post a person declined on its
 * card is their decision (`declined`), the graph's business end `declined`, never a failure.
 */
export const teamAnswerPostNode: TemplateNode<
    NodeSchema<AnswerPostInput>,
    NodeSchema<AnswerPostOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "team.answer-post",
    title: bilingualOf("nodeTeamAnswerPostTitle"),
    description: { vi: "\u0110\u0103ng c\u00e2u tr\u1ea3 l\u1eddi v\u00e0o ph\u00f2ng chat, d\u01b0\u1edbi d\u1ea1ng tr\u1ea3 l\u1eddi tin nh\u1eafn c\u1ee7a ng\u01b0\u1eddi h\u1ecfi.", en: "Posts the answer in the chat room as a reply to the person's message." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    run: async (given, context) => {
        const posted = await context.tools.call(TOOL.teamMessagePost, {
            kind: "chat.answer",
            messageId: given.messageId,
            text: given.answer,
        })
        if (!posted.ok && posted.declined === true) return { posted: false, declined: true }
        valueOrCannot(context, TOOL.teamMessagePost, posted)
        return { posted: true, declined: false }
    },
    examples: [
        {
            name: "posts the answer in the room as a reply to the asked message",
            params: {},
            input: { messageId: TEAM_CHAT_ASKED, answer: sampleOf("sampleTeamChatQuestionAnswer") },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: replyPost(sampleOf("sampleTeamChatQuestionAnswer")),
                    answer: answered(postedAs("m-answer-1")),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "posts a polite refusal the same way: the post does not read the words",
            params: {},
            input: { messageId: TEAM_CHAT_ASKED, answer: sampleOf("sampleTeamChatMoneyRefusal") },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: replyPost(sampleOf("sampleTeamChatMoneyRefusal")),
                    answer: answered(postedAs("m-answer-2")),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "a person declined the post on its card: nothing is posted, the step says declined",
            params: {},
            input: { messageId: TEAM_CHAT_ASKED, answer: sampleOf("sampleTeamChatQuestionAnswer") },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: replyPost(sampleOf("sampleTeamChatQuestionAnswer")),
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, declined: true },
        },
        {
            name: "a message that is not a person's line of the room: the refused post fails the step as cannot",
            params: {},
            input: { messageId: TEAM_CHAT_ASKED, answer: sampleOf("sampleTeamChatQuestionAnswer") },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: replyPost(sampleOf("sampleTeamChatQuestionAnswer")),
                    answer: refused("not_person_line"),
                },
            ],
            failure: { kind: "cannot", why: `${TOOL.teamMessagePost} refused: not_person_line` },
        },
    ],
})
