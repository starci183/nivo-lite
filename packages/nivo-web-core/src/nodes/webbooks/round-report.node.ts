import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksText } from "../../modules/webbooks/copy"
import { RESULTS_MAX, ROUND_MAX, idSchema, localeSchema } from "./books-shapes"
import { ownOk, refused } from "./books.fixtures"
import { DUE_EXAMPLE, HELD_EXAMPLE, dueReceivableSchema, heldReceivableSchema } from "./due.node"
import { noticeOutputSchema } from "./notice-record.node"
import { postTeamLine, teamLineSchema, teamPostArgsOf } from "./team-line"

/**
 * The round as the loop and the due step answer it: every receivable due today with its reason; per item of the loop its key (the
 * `projectCode`) and the collected `webbooks.notice-record` output, null when no customer mail went for it (the truths said not
 * now, no e-mail, the mailbox absent, the person declined: the round's `drafted` check ended the item before the record), its
 * `declined` true when a person declined the record (the team was told on its own); and what the due step held back.
 */
const input = z.object({
    due: z.array(dueReceivableSchema).max(ROUND_MAX),
    items: z.array(z.object({ key: idSchema, output: noticeOutputSchema.nullable() })).max(RESULTS_MAX),
    held: z.array(heldReceivableSchema).max(ROUND_MAX),
    locale: localeSchema,
})

/** What the agent writes: the one message and the project codes it names as reminded. */
const answer = z.object({
    line: teamLineSchema,
    reminded: z
        .array(idSchema)
        .max(RESULTS_MAX)
        .describe("The `projectCode` of every receivable your message names as reminded."),
})

const output = z.object({
    posted: z.boolean().describe("True once the message was posted to the team; false when a person declined it."),
    declined: z.boolean().describe("True when a person declined the team post on its card: nothing was posted."),
    reminded: z.array(idSchema).max(RESULTS_MAX),
})

const GOAL =
    "Write ONE message for the team on the result of this morning's receivable round, in the team's language: each receivable reminded " +
    "(the team was told of every one in `due`; say for each whether a customer mail went and was recorded, from its item: an item with " +
    "no output (null) had no customer mail, an item `declined` had its record declined by a person), each held back with its reason. " +
    "No amount, no customer's words."

const REMINDED = {
    projectCode: "SITE2-WEB",
    noticeId: "notice-0001",
    refusal: null,
    declined: false,
    why: "Soan thu nhac cho khach, cho nguoi duyet gui.",
} as const

const LINE = {
    title: "Nhac cong no sang nay",
    text: "Da nhac: SITE2-WEB (thu nhac da gui khach sau khi nguoi duyet).\nGiu lai: SITE3-WEB - da nhac ngay 10/11, chua du 7 ngay.",
}

/** The line of a round where the receivable's customer got no mail. */
const NO_MAIL_LINE = {
    title: "Nhac cong no sang nay",
    text: "Da bao nguoi phu trach: SITE2-WEB (chua gui thu cho khach).\nGiu lai: SITE3-WEB - da nhac ngay 10/11, chua du 7 ngay.",
}

/**
 * `webbooks.round-report` (Tell the team the reminder round), converted in place: the agent writes the one message from the
 * round's results; the node posts it (`TOOL.teamMessagePost`, intent `report`). It writes nothing else and never to a customer. A
 * report post, non-blocking (ADDENDUM 2).
 */
export const webbooksRoundReportNode: TemplateNode = defineTemplateNode({
    id: "webbooks.round-report",
    title: webbooksText("node.round-report.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i k\u1ebft qu\u1ea3 v\u00f2ng nh\u1eafc n\u1ee3: kho\u1ea3n \u0111\u00e3 nh\u1eafc v\u00e0 kho\u1ea3n gi\u1eef l\u1ea1i.", en: "Reports the reminder round to the team: who was reminded and who was held back." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, ctx) => {
        const written = await ctx.agent.run({ goal: GOAL, input: given, output: answer, maxTurns: 1, tools: [] })
        const post = await postTeamLine(ctx, "report", written.line)
        if (post.declined) return { posted: false, declined: true, reminded: [] }
        return { posted: true, declined: false, reminded: written.reminded }
    },
    examples: [
        {
            name: "one message: the reminded receivable and the held one with its reason",
            params: {},
            input: {
                due: [DUE_EXAMPLE],
                items: [{ key: "SITE2-WEB", output: REMINDED }],
                held: [HELD_EXAMPLE],
                locale: "vi",
            },
            agent: [{ answer: { line: LINE, reminded: ["SITE2-WEB"] } }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("report", LINE),
                    answer: ownOk({ messageId: "team-message-2" }),
                },
            ],
            output: { posted: true, declined: false, reminded: ["SITE2-WEB"] },
        },
        {
            name: "a person declines the team post: nothing is posted and the step returns declined",
            params: {},
            input: {
                due: [DUE_EXAMPLE],
                items: [{ key: "SITE2-WEB", output: REMINDED }],
                held: [HELD_EXAMPLE],
                locale: "vi",
            },
            agent: [{ answer: { line: LINE, reminded: ["SITE2-WEB"] } }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("report", LINE),
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, declined: true, reminded: [] },
        },
        {
            name: "a receivable with no customer mail (its item's output null) is named as told to the team only",
            params: {},
            input: {
                due: [DUE_EXAMPLE],
                items: [{ key: "SITE2-WEB", output: null }],
                held: [HELD_EXAMPLE],
                locale: "vi",
            },
            agent: [{ answer: { line: NO_MAIL_LINE, reminded: ["SITE2-WEB"] } }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("report", NO_MAIL_LINE),
                    answer: ownOk({ messageId: "team-message-3" }),
                },
            ],
            output: { posted: true, declined: false, reminded: ["SITE2-WEB"] },
        },
    ],
})
