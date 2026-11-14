import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { answered, refused } from "../tool-answers"
import { HIRING_SAMPLE, SAMPLE_SUMMARY } from "./hiring.samples"

type NoParams = Record<string, never>

/** The line the team reads. */
export interface NotifyInput {
    /** A short heading. */
    readonly title: string
    /** The words. */
    readonly text: string
}

/** Whether the team was told. */
export interface NotifyOutput {
    /** True once the line is posted on /chat. */
    readonly posted: boolean
    /** The post tool's refusal when it refused, else null. */
    readonly refusal: string | null
}

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<NotifyInput> = z.object({
    title: z.string().min(1).max(MAX_LINE),
    text: z.string().min(1).max(MAX_BODY),
})
const output: NodeSchema<NotifyOutput> = z.object({ posted: z.boolean(), refusal: z.string().max(MAX_ID).nullable() })

/** The team post of a hiring line. */
const postArgs = (title: string, text: string): Readonly<Record<string, string>> => ({
    kind: "message.text",
    intent: "notify",
    audience: "own",
    title,
    text,
})

/** The heading of the examples. */
const TITLE = HIRING_SAMPLE.notifyTitle

/**
 * `hiring.notify` (tell the team): posts the hiring line a previous step wrote (a screening, the morning digest) on /chat. A side step
 * (`blocking: false`): a refused post is said in the output and never stops the flow.
 */
export const hiringNotifyNode: TemplateNode<
    NodeSchema<NotifyInput>,
    NodeSchema<NotifyOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "hiring.notify",
    title: bilingualOf("nodeHiringNotifyTitle"),
    description: { vi: "\u0110\u0103ng cho \u0111\u1ed9i d\u00f2ng tuy\u1ec3n d\u1ee5ng \u0111\u00e3 vi\u1ebft s\u1eb5n, nh\u01b0 k\u1ebft qu\u1ea3 s\u00e0ng l\u1ecdc hay b\u1ea3n t\u00f3m t\u1eaft bu\u1ed5i s\u00e1ng.", en: "Posts the ready-written hiring line to the team, such as a screening or the morning digest." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    blocking: false,
    run: async (given, context) => {
        const posted = await context.tools.call(TOOL.teamMessagePost, postArgs(given.title, given.text))
        return posted.ok ? { posted: true, refusal: null } : { posted: false, refusal: posted.declined === true ? "declined" : posted.refusal }
    },
    examples: [
        {
            name: "posts the screening to the team",
            params: {},
            input: { title: TITLE, text: SAMPLE_SUMMARY },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: postArgs(TITLE, SAMPLE_SUMMARY),
                    answer: answered({ messageId: "m-1" }),
                },
            ],
            output: { posted: true, refusal: null },
        },
        {
            name: "a declined post is said in the output and does not stop the flow",
            params: {},
            input: { title: TITLE, text: SAMPLE_SUMMARY },
            tools: [{ id: TOOL.teamMessagePost, args: postArgs(TITLE, SAMPLE_SUMMARY), answer: refused("declined") }],
            output: { posted: false, refusal: "declined" },
        },
    ],
})
