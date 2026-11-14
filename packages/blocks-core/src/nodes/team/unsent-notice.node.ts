import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { answered, refused } from "../tool-answers"

type NoParams = Record<string, never>

/** The step whose message did not reach the customer, the record it was about, why, and the language of the notice. */
export interface UnsentNoticeInput {
    /** The plain title of the step that wrote the message, as the graph binds it (a literal). */
    readonly step: string
    /** The code of the record the message was about (an order number), or null when none. */
    readonly ref: string | null
    /** What the send answered instead of a delivery: its refusal code, `declined` when a person declined it on its card; null when it said none. */
    readonly refusal: string | null
    /** The language of the notice; Vietnamese when absent. */
    readonly locale: NodeLocale
}

/** The input as a graph binds it: the record and the language may be absent. */
export interface UnsentNoticeInputGiven {
    /** The step that wrote the message. */
    readonly step: string
    /** The record the message was about; absent when there is none. */
    readonly ref?: string | null | undefined
    /** The send's refusal (or `declined`); null when it said none. */
    readonly refusal: string | null
    /** The language the notice is written in; Vietnamese when absent. */
    readonly locale?: NodeLocale | undefined
}

/** Whether the team was told, and the post's refusal when it was refused. */
export interface UnsentNoticeOutput {
    /** True when the notice was posted. */
    readonly posted: boolean
    /** Why the notice could not be posted; null when it was. */
    readonly refusal: string | null
}

const params: NodeSchema<NoParams> = z.strictObject({})

const input: NodeSchema<UnsentNoticeInput, UnsentNoticeInputGiven> = z.object({
    step: z.string().min(1).max(MAX_LINE),
    ref: z.string().min(1).max(MAX_ID).nullable().default(null),
    // The send's refusal as the sending steps state it (care.steps `refusalSchema`).
    refusal: z.string().max(MAX_LINE).nullable(),
    locale: z.enum(["vi", "en"]).default("vi"),
})

const output: NodeSchema<UnsentNoticeOutput> = z.object({
    posted: z.boolean().describe("True once the notice was posted to the team."),
    refusal: z.string().max(MAX_ID).nullable().describe("The post tool's refusal when it refused, else null."),
})

/** The one line of the notice, from the catalogue: the step, its record when there is one, and what the send answered when it said. */
const lineOf = (given: UnsentNoticeInput): string => {
    const line = (
        given.ref === null
            ? messageOf(given.locale, "nodeTeamUnsentNoticeLine")
            : messageOf(given.locale, "nodeTeamUnsentNoticeLineRef").replaceAll("{ref}", given.ref)
    ).replaceAll("{step}", given.step)
    return given.refusal === null ? line : `${line} ${messageOf(given.locale, "nodeTeamUnsentNoticeReason").replaceAll("{refusal}", given.refusal)}`
}

/** The post as `nivo.tool.team.message.post` takes it: plain words (`message.text`) telling (`notify`) the founder. */
const noticeOf = (given: UnsentNoticeInput): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    audience: "founder",
    title: messageOf(given.locale, "nodeTeamUnsentNoticeHeading"),
    text: lineOf(given),
})

/** The step of the examples: the order talk, as the sale binds its title. */
const ORDER_TALK_STEP = "Trao đổi về đơn"

/** The notice of the examples: the order talk's answer about DH-0042 was refused by the channel. */
const UNSENT: UnsentNoticeInput = { step: ORDER_TALK_STEP, ref: "DH-0042", refusal: "outside_window", locale: "vi" }

/**
 * `team.unsent-notice` (Bao doi tin chua toi khach): a step wrote the customer a message and the send did not deliver it (the engine refused
 * it, or a person declined it on its card), and the graph goes on. An unhandled case is never silent: the founder is told on /chat, in one
 * catalogue line, which step's message did not reach the customer, the record it was about and what the send answered, for a person to
 * reach the customer. No AI call, no customer text. A graph does NOT bind it for a send refused under a staff hold (`route_held`): a person
 * holds that thread (ruling R45). A side node (`blocking: false`): a notice that cannot be posted is said in the output.
 */
export const teamUnsentNoticeNode: TemplateNode<
    NodeSchema<UnsentNoticeInput, UnsentNoticeInputGiven>,
    NodeSchema<UnsentNoticeOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "team.unsent-notice",
    title: bilingualOf("nodeTeamUnsentNoticeTitle"),
    description: {
        vi: "Báo cho chủ cửa hàng biết tin nhắn một bước viết cho khách đã không tới được khách, kèm lý do, để một người liên hệ khách.",
        en: "Tells the owner that a step's message to the customer did not reach them, with the reason, for a person to reach the customer.",
    },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    blocking: false,
    run: async (given, ctx) => {
        const posted = await ctx.tools.call(TOOL.teamMessagePost, noticeOf(given))
        return posted.ok ? { posted: true, refusal: null } : { posted: false, refusal: posted.declined === true ? "declined" : posted.refusal }
    },
    examples: [
        {
            name: "an answer about order DH-0042 the channel refused: the founder is told the step, the order and the refusal",
            params: {},
            input: { step: ORDER_TALK_STEP, ref: "DH-0042", refusal: "outside_window" },
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(UNSENT), answer: answered({ messageId: "team-message-1" }) }],
            output: { posted: true, refusal: null },
        },
        {
            name: "a message about no record a person declined on its card, in an English workspace: the line names the step and `declined`",
            params: {},
            input: { step: "Thank the customer", ref: null, refusal: "declined", locale: "en" },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: noticeOf({ step: "Thank the customer", ref: null, refusal: "declined", locale: "en" }),
                    answer: answered({ messageId: "team-message-1" }),
                },
            ],
            output: { posted: true, refusal: null },
        },
        {
            name: "a refused team post is said in the output; the run goes on",
            params: {},
            input: { step: ORDER_TALK_STEP, ref: "DH-0042", refusal: "outside_window" },
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(UNSENT), answer: refused("not_granted") }],
            output: { posted: false, refusal: "not_granted" },
        },
    ],
})
