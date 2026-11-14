import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { answered, refused } from "../web-answers"
import { ANSWER_MAX } from "./doc-shapes"
import { webdocsText } from "../../modules/webdocs/copy"

/** The draft step's title and answer. */
export interface DraftPostInput {
    /** The title, as shown in the team notice or document. */
    readonly title: string
    /** The answer text. */
    readonly answer: string
}

/** Whether the answer reached the team: `posted` false and `declined` true when a person declined the post on its card. */
export interface DraftPostOutput {
    /** True when the team notice was posted. */
    readonly posted: boolean
    /** True when a person declined the post: the team was not given the draft. */
    readonly declined: boolean
}

type NoParams = Record<string, never>

/** The kind of plain words to the team. */
const TEXT_KIND = "message.text"

const params: z.ZodType<NoParams> = z.strictObject({})
const input: z.ZodType<DraftPostInput> = z.object({
    title: z.string().min(1).max(200),
    answer: z.string().min(1).max(ANSWER_MAX),
})
const output: z.ZodType<DraftPostOutput> = z.object({
    posted: z.boolean(),
    declined: z.boolean().describe("True when a person declined the team post on its card: nothing was posted."),
})

const reportOf = (title: string, text: string): Readonly<Record<string, string>> => ({
    kind: TEXT_KIND,
    intent: "report",
    title,
    text,
})

const CONTRACT_TITLE = "Hop dong dich vu - MUA-0031"
const CONTRACT =
    "HOP DONG DICH VU (so: [can bo sung])\nBen A: khach KH-0142 ...\nDay la ban nhap de anh/chi xem va ky tay."
const SHORT =
    "Em chua tim thay mau bien ban ban giao trong tai lieu cua cong ty. Anh/chi tai mau len Second Brain hoac gui em noi dung can co nhe."

/**
 * `webdocs.draft-post` (Hand the draft to the team): one team post of the draft step's answer, for a request a workflow handed over (no
 * person's message to reply to; the team-chat graph replies with blocks-core `team.answer-post` instead). Split from `webdocs.draft`.
 * No AI call, no key: the engine posts once per run step (contract C4). It is the purpose of the draft graph, so a refused post stops the
 * step and the engine reports it.
 */
export const webdocsDraftPostNode: TemplateNode<
    z.ZodType<DraftPostInput>,
    z.ZodType<DraftPostOutput>,
    z.ZodType<NoParams>
> = defineTemplateNode({
    id: "webdocs.draft-post",
    title: webdocsText("node.draft-post.title"),
    description: { vi: "G\u1eedi b\u1ea3n nh\u00e1p gi\u1ea5y t\u1edd v\u1eeba so\u1ea1n cho \u0111\u1ed9i.", en: "Sends the paperwork draft to the team." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    sensitive: { answer: "pii" },
    run: async (given, context) => {
        const posted = await context.tools.call(TOOL.teamMessagePost, reportOf(given.title, given.answer))
        if (!posted.ok && posted.declined === true) return { posted: false, declined: true }
        if (!posted.ok)
            return context.fail({ kind: "cannot", why: `team_post_refused:${posted.refusal}` }, posted.facts)
        return { posted: true, declined: false }
    },
    examples: [
        {
            name: "posts the contract drafted for the Sales agent's close to the team",
            params: {},
            input: { title: CONTRACT_TITLE, answer: CONTRACT },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: reportOf(CONTRACT_TITLE, CONTRACT),
                    answer: answered({ messageId: "m-1" }),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "a person declines the post: nothing is posted and the step returns declined",
            params: {},
            input: { title: CONTRACT_TITLE, answer: CONTRACT },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: reportOf(CONTRACT_TITLE, CONTRACT),
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, declined: true },
        },
        {
            name: "posts a short answer saying what is missing when no source was found",
            params: {},
            input: { title: "Bien ban ban giao website", answer: SHORT },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: reportOf("Bien ban ban giao website", SHORT),
                    answer: answered({ messageId: "m-2" }),
                },
            ],
            output: { posted: true, declined: false },
        },
    ],
})
