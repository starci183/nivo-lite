import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { answered, refused } from "../web-answers"
import { POST_MAX } from "./desk-shapes"
import { webdeskText } from "../../modules/webdesk/copy"

/**
 * The message for the team an earlier step wrote: its title and text. Either may read nothing (the link line exists only for a customer
 * linked to no CRM customer), and then there is nothing to post.
 */
export interface TeamTellInput {
    /** The title of the team notice; null when none. */
    readonly title?: string | null | undefined
    /** The body of the team notice; null when none. */
    readonly text?: string | null | undefined
}

/** Whether the team was told (false when there was nothing to tell, or a person declined the post). */
export interface TeamTellOutput {
    /** True when the team notice was posted. */
    readonly posted: boolean
    /** True when a person declined the post on its card: the team was not told. */
    readonly declined: boolean
}

type NoParams = Record<string, never>

/** The kind of the team message: plain words. */
const TEXT_KIND = "message.text"

const params: z.ZodType<NoParams> = z.strictObject({})
const input: z.ZodType<TeamTellInput> = z.object({
    title: z.string().min(1).max(200).nullish(),
    text: z.string().min(1).max(POST_MAX).nullish(),
})
const output: z.ZodType<TeamTellOutput> = z.object({
    posted: z.boolean(),
    declined: z.boolean().describe("True when a person declined the team post on its card: nothing was posted."),
})

/** The post of an example: a question to the team's own people. */
const postOf = (title: string, text: string): Readonly<Record<string, string>> => ({
    kind: TEXT_KIND,
    intent: "ask",
    audience: "own",
    title,
    text,
})

/**
 * `webdesk.team-tell` (Tell the team): one post to the team on /chat of a message an earlier step wrote: the plan of a ticket
 * (the diagnosis, what it rests on, the fix proposed for a person to carry out, the quote), or the line that a customer is not
 * linked to the CRM yet. Split from `webdesk.mail-plan` and `webdesk.respond-told`, and used twice in `webdesk.ticket`
 * (`team-tell`, `link-ask`). No AI call. It stays BLOCKING although it is a team notice: the plan it posts is what a person acts
 * on (the old steps required the post), so a refused post stops the run and the engine reports it. With no title or text there is
 * nothing to post (exact checks).
 */
export const webdeskTeamTellNode: TemplateNode<
    z.ZodType<TeamTellInput>,
    z.ZodType<TeamTellOutput>,
    z.ZodType<NoParams>
> = defineTemplateNode({
    id: "webdesk.team-tell",
    title: webdeskText("node.team-tell.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i ch\u1ea9n \u0111o\u00e1n, h\u01b0\u1edbng x\u1eed l\u00fd v\u00e0 b\u00e1o gi\u00e1 c\u1ee7a phi\u1ebfu.", en: "Tells the team the ticket's diagnosis, proposed fix and quote." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    sensitive: { text: "pii" },
    run: async (given, context) => {
        if (given.title === null || given.title === undefined) return { posted: false, declined: false }
        if (given.text === null || given.text === undefined) return { posted: false, declined: false }
        const posted = await context.tools.call(TOOL.teamMessagePost, postOf(given.title, given.text))
        if (!posted.ok && posted.declined === true) return { posted: false, declined: true }
        if (!posted.ok)
            return context.fail({ kind: "cannot", why: `team_post_refused:${posted.refusal}` }, posted.facts)
        return { posted: true, declined: false }
    },
    examples: [
        {
            name: "posts the plan of a ticket to the team's own people",
            params: {},
            input: {
                title: "TK-0001: web loi 500 (bao hanh)",
                text: "TK-0001 - KH-0001 bao web example.vn loi 500 tu sang. De xuat: xem log loi PHP.",
            },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: postOf(
                        "TK-0001: web loi 500 (bao hanh)",
                        "TK-0001 - KH-0001 bao web example.vn loi 500 tu sang. De xuat: xem log loi PHP.",
                    ),
                    answer: answered({ messageId: "m-1" }),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "a person declines the team post: nothing is posted and the step returns declined",
            params: {},
            input: {
                title: "TK-0001: web loi 500 (bao hanh)",
                text: "TK-0001 - KH-0001 bao web example.vn loi 500 tu sang. De xuat: xem log loi PHP.",
            },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: postOf(
                        "TK-0001: web loi 500 (bao hanh)",
                        "TK-0001 - KH-0001 bao web example.vn loi 500 tu sang. De xuat: xem log loi PHP.",
                    ),
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, declined: true },
        },
        {
            name: "no message written (a linked customer has no link line): nothing is posted",
            params: {},
            input: { title: null, text: null },
            output: { posted: false, declined: false },
        },
    ],
})
