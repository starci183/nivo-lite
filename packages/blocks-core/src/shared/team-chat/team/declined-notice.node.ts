import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import type { NodeLocale, NodeSchema } from "../../nodes/node-schema.types"
import { answered, refused } from "../../nodes/tool-answers"

type NoParams = Record<string, never>

/** What the decline stopped: the whole run (`run`), or one item of a loop whose round goes on (`item`). */
export type DeclinedNoticeScope = "run" | "item"

/** The step a person declined, the record it was about, and the language of the notice. */
export interface DeclinedNoticeInput {
    /** The plain title of the declined step, as the graph binds it (a literal). */
    readonly step: string
    /** The code of the record the step was about (order number, purchase code, service code, ticket id), or null when none. */
    readonly ref: string | null
    /** The language of the notice; Vietnamese when absent. */
    readonly locale: NodeLocale
    /** What the decline stopped: the run (the default), or one item of a loop (the round goes on). */
    readonly scope: DeclinedNoticeScope
}

/** The input as a graph binds it: the record and the language may be absent. */
export interface DeclinedNoticeInputGiven {
    /** The step that was declined. */
    readonly step: string
    /** A reference to what was declined (an order, a draft); absent when there is none. */
    readonly ref?: string | null | undefined
    /** The language the notice is written in; the workspace default when absent. */
    readonly locale?: NodeLocale | undefined
    /** Where the notice is posted; the node default when absent. */
    readonly scope?: DeclinedNoticeScope | undefined
}

/** Whether the team was told, and the post's refusal when it was refused. */
export interface DeclinedNoticeOutput {
    /** True when the notice was posted. */
    readonly posted: boolean
    /** Why the notice could not be posted; null when it was. */
    readonly refusal: string | null
}

const params: NodeSchema<NoParams> = z.strictObject({})

const input: NodeSchema<DeclinedNoticeInput, DeclinedNoticeInputGiven> = z.object({
    step: z.string().min(1).max(MAX_LINE),
    ref: z.string().min(1).max(MAX_ID).nullable().default(null),
    locale: z.enum(["vi", "en"]).default("vi"),
    scope: z.enum(["run", "item"]).default("run"),
})

const output: NodeSchema<DeclinedNoticeOutput> = z.object({
    posted: z.boolean().describe("True once the notice was posted to the team."),
    refusal: z.string().max(MAX_ID).nullable().describe("The post tool's refusal when it refused, else null."),
})

/** The catalogue line of each scope, without and with the record. */
const LINE_KEYS = {
    run: { bare: "nodeTeamDeclinedNoticeLine", withRef: "nodeTeamDeclinedNoticeLineRef" },
    item: { bare: "nodeTeamDeclinedNoticeItemLine", withRef: "nodeTeamDeclinedNoticeItemLineRef" },
} as const

/**
 * The one line of the notice, from the catalogue: the declined step, its record when there is one, and what stopped (the workflow, or
 * only this item of the round).
 */
const lineOf = (given: DeclinedNoticeInput): string => {
    const keys = LINE_KEYS[given.scope]
    return given.ref === null
        ? messageOf(given.locale, keys.bare).replaceAll("{step}", given.step)
        : messageOf(given.locale, keys.withRef).replaceAll("{step}", given.step).replaceAll("{ref}", given.ref)
}

/** The post as `nivo.tool.team.message.post` takes it: plain words (`message.text`) telling (`notify`) the founder. */
const noticeOf = (given: DeclinedNoticeInput): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    audience: "founder",
    title: messageOf(given.locale, "nodeTeamDeclinedNoticeHeading"),
    text: lineOf(given),
})

/** What the post tool answers: the message it wrote (not read). */
const POSTED: JsonObject = { messageId: "team-message-1" }

/** The vi title of the order-cancel step, as a graph binds it. */
const CANCEL_STEP = "Hu\u1ef7 \u0111\u01a1n"

/** A step title of a loop's body, as a plugin graph binds it (any literal: the node does not read it). */
const RENEW_STEP = "G\u1eedi nh\u1eafc gia h\u1ea1n"

/**
 * `team.declined-notice` (Bao doi buoc bi tu choi): the one team-notice step of a graph's `declined` branch. A person declined an
 * approval of a step: a decision, never a failure. This step tells the founder on /chat, in one catalogue line, which step was declined
 * (and the record it was about) and that the workflow stopped there (`scope: "run"`, the default) or, inside a loop, that only this item
 * is skipped and the round goes on (`scope: "item"`) (`TOOL.teamMessagePost`, `message.text` of intent `notify`, to the
 * founder). No AI call. A side node (`blocking: false`): a notice that cannot be posted is said in the output and the run still ends as
 * `declined`.
 */
export const teamDeclinedNoticeNode: TemplateNode<
    NodeSchema<DeclinedNoticeInput, DeclinedNoticeInputGiven>,
    NodeSchema<DeclinedNoticeOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "team.declined-notice",
    title: bilingualOf("nodeTeamDeclinedNoticeTitle"),
    description: { vi: "B\u00e1o cho ch\u1ee7 c\u1eeda h\u00e0ng bi\u1ebft m\u1ed9t b\u01b0\u1edbc \u0111\u00e3 b\u1ecb t\u1eeb ch\u1ed1i v\u00e0 quy tr\u00ecnh d\u1eebng l\u1ea1i \u1edf \u0111\u00f3 (ho\u1eb7c ch\u1ec9 b\u1ecf qua m\u1ee5c \u0111\u00f3).", en: "Tells the owner a step was declined and that the workflow stopped there (or only that item was skipped)." },
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
            name: "a person declined cancelling order DH-0042: the founder is told the step, the order and that the workflow stopped",
            params: {},
            input: { step: CANCEL_STEP, ref: "DH-0042" },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: noticeOf({ step: CANCEL_STEP, ref: "DH-0042", locale: "vi", scope: "run" }),
                    answer: answered(POSTED),
                },
            ],
            output: { posted: true, refusal: null },
        },
        {
            name: "a declined step about no record, in an English workspace: the line names the step alone",
            params: {},
            input: { step: "Post to the ledger", ref: null, locale: "en" },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: noticeOf({ step: "Post to the ledger", ref: null, locale: "en", scope: "run" }),
                    answer: answered(POSTED),
                },
            ],
            output: { posted: true, refusal: null },
        },
        {
            name: "a person declined the team post on its card: the refusal is said in the output, the run still ends as declined",
            params: {},
            input: { step: CANCEL_STEP, ref: "DH-0042" },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: noticeOf({ step: CANCEL_STEP, ref: "DH-0042", locale: "vi", scope: "run" }),
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, refusal: "declined" },
        },
        {
            name: "inside a loop a person declined the step for one item: the founder is told that item is skipped and the round goes on",
            params: {},
            input: { step: RENEW_STEP, ref: "SV-0007", scope: "item" },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: noticeOf({ step: RENEW_STEP, ref: "SV-0007", locale: "vi", scope: "item" }),
                    answer: answered(POSTED),
                },
            ],
            output: { posted: true, refusal: null },
        },
        {
            name: "a declined item about no record, in an English workspace: the line names the step and that the round goes on",
            params: {},
            input: { step: "Send the renewal reminder", ref: null, locale: "en", scope: "item" },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: noticeOf({ step: "Send the renewal reminder", ref: null, locale: "en", scope: "item" }),
                    answer: answered(POSTED),
                },
            ],
            output: { posted: true, refusal: null },
        },
    ],
})
