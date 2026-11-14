import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import type { TeamLocale } from "./books-shapes"
import { TRUTHS_NOTICE, ownOk, refused } from "./books.fixtures"
import { DUE_EXAMPLE, type DueReceivable, dueItemSchema } from "./due.node"
import { postTeamLine, teamLineSchema, teamPostArgsOf } from "./team-line"
import { webbooksText } from "../../modules/webbooks/copy"

/** One due receivable, as the round's loop hands it, and the language the team reads. */
export type NoticeItemInput = DueReceivable & {
    /** The language the team notice is written in. */
    readonly locale: TeamLocale
}

/** The schema of a loop item with the team's language: what every body step of the round takes. */
export const noticeItemSchema: z.ZodType<NoticeItemInput> = dueItemSchema

const output = z.object({
    posted: z.boolean().describe("True once the line was posted to the team; false when a person declined it."),
    declined: z.boolean().describe("True when a person declined the team post on its card: nothing was posted."),
})

const GOAL =
    "Write ONE line for the team about this due project receivable, in the team's language, before anything goes to the customer: what " +
    "is due and since when (as given), and the person in charge when a truth of the company says who. No amount, no customer's words."

/** The line of the worked example. */
const LINE = {
    title: "Nhac cong no SITE2-WEB",
    text: "SITE2-WEB (KH-0002) qua han tu 30/10, chua nhac lan nao: can nhac khach.",
}

/**
 * `webbooks.notice-team` (Remind the person in charge): split from `webbooks.notice`, the first body step of the receivable
 * round. The agent writes the line from the truths (who owns it inside the team); the node posts it (`TOOL.teamMessagePost`,
 * intent `notify`). A side node (`blocking: false`): a post that cannot be made does not stop the round.
 */
export const webbooksNoticeTeamNode: TemplateNode = defineTemplateNode({
    id: "webbooks.notice-team",
    title: webbooksText("node.notice-team.title"),
    description: { vi: "Nh\u1eafc ng\u01b0\u1eddi ph\u1ee5 tr\u00e1ch li\u00ean h\u1ec7 kh\u00e1ch c\u00f3 kho\u1ea3n qu\u00e1 h\u1ea1n.", en: "Reminds the person in charge to contact the customer with an overdue receivable." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input: noticeItemSchema,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, ctx) => {
        const line = await ctx.agent.run({
            goal: GOAL,
            input: given,
            output: teamLineSchema,
            maxTurns: 3,
            tools: [],
        })
        const post = await postTeamLine(ctx, "notify", line)
        return { posted: !post.declined, declined: post.declined }
    },
    examples: [
        {
            name: "tells the team first, naming the receivable and its due date as given",
            params: {},
            input: { ...DUE_EXAMPLE, locale: "vi" },
            agent: [
                {
                    answer: LINE,
                    calls: [
                        {
                            id: TOOL.brainSearch,
                            args: { query: "nguoi phu trach cong no SITE2-WEB" },
                            answer: ownOk({ notice: TRUTHS_NOTICE, facts: [] }),
                        },
                    ],
                },
            ],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("notify", LINE),
                    answer: ownOk({ messageId: "team-message-1" }),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "a person declines the team post: nothing is posted and the step returns declined",
            params: {},
            input: { ...DUE_EXAMPLE, locale: "vi" },
            agent: [
                {
                    answer: LINE,
                    calls: [
                        {
                            id: TOOL.brainSearch,
                            args: { query: "nguoi phu trach cong no SITE2-WEB" },
                            answer: ownOk({ notice: TRUTHS_NOTICE, facts: [] }),
                        },
                    ],
                },
            ],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("notify", LINE),
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, declined: true },
        },
    ],
})
