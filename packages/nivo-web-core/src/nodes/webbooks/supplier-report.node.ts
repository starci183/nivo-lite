import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksText } from "../../modules/webbooks/copy"
import { RESULTS_MAX, idSchema, localeSchema } from "./books-shapes"
import { ownOk, refused } from "./books.fixtures"
import { MATCHED_EXAMPLE } from "./supplier-check.node"
import { supplierNoteOutputSchema } from "./supplier-note.node"
import { postTeamLine, teamLineSchema, teamPostArgsOf } from "./team-line"

/**
 * The checked invoices as the loop answers them (contract C4.4): per mail its key (the `mailId`) and the collected
 * `webbooks.supplier-note` output (what the check found, and whether it was noted or its note declined; null when the item failed);
 * and how many the loop held past its cap. The graph reaches this step only when the hand-off held at least one mail.
 */
const input = z.object({
    items: z.array(z.object({ key: idSchema, output: supplierNoteOutputSchema.nullable() })).max(RESULTS_MAX),
    held: z
        .object({ count: z.number().int().min(1), firstKey: idSchema })
        .nullable()
        .default(null),
    locale: localeSchema,
})

/** What the agent writes: the one message and the mails it names. */
const answer = z.object({
    line: teamLineSchema,
    named: z.array(idSchema).max(RESULTS_MAX).describe("The `mailId` of every invoice your message names."),
})

const output = z.object({
    posted: z.boolean().describe("True once the message was posted to the team; false when a person declined it."),
    declined: z.boolean().describe("True when a person declined the team post on its card: nothing was posted."),
    named: z.array(idSchema).max(RESULTS_MAX),
})

const GOAL =
    "Write ONE message for the team about the supplier invoices checked in this hand-off, in the team's language: each matched one with " +
    "its payable (noted on the payable when it has a `noteId`; `declined` when a person declined the note), each one a person must " +
    "look at with why, and, when some were held past the loop's most, how many are left for a person."

/** The matched invoice of the examples, noted on its payable. */
const NOTED = { ...MATCHED_EXAMPLE, noteId: "pnote-0001", declined: false }

const LINE = {
    title: "Hoa don nha cung cap",
    text: "Khop: NCC-MAU - hoa don 0000456 (da ghi chu vao cong no phai tra).",
}

/**
 * `webbooks.supplier-report` (Tell the team about supplier invoices), converted in place: the agent writes the one message; the
 * node posts it (`TOOL.teamMessagePost`, intent `report`). Today's "post nothing for an empty hand-off" is an exact emptiness
 * check and moved to the graph's `ifNode` (`any-mail`) in front of the loop. A report post, non-blocking (ADDENDUM 2).
 */
export const webbooksSupplierReportNode: TemplateNode = defineTemplateNode({
    id: "webbooks.supplier-report",
    title: webbooksText("node.supplier-report.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i k\u1ebft qu\u1ea3 \u0111\u1ed1i chi\u1ebfu ho\u00e1 \u0111\u01a1n nh\u00e0 cung c\u1ea5p.", en: "Tells the team the result of checking the supplier invoice." },
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
        if (post.declined) return { posted: false, declined: true, named: [] }
        return { posted: true, declined: false, named: written.named }
    },
    examples: [
        {
            name: "names the matched invoice in one team message",
            params: {},
            input: { items: [{ key: MATCHED_EXAMPLE.mailId, output: NOTED }], locale: "vi" },
            agent: [{ answer: { line: LINE, named: [MATCHED_EXAMPLE.mailId] } }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("report", LINE),
                    answer: ownOk({ messageId: "team-message-7" }),
                },
            ],
            output: { posted: true, declined: false, named: [MATCHED_EXAMPLE.mailId] },
        },
        {
            name: "a person declines the team post: nothing is posted and the step returns declined",
            params: {},
            input: { items: [{ key: MATCHED_EXAMPLE.mailId, output: NOTED }], locale: "vi" },
            agent: [{ answer: { line: LINE, named: [MATCHED_EXAMPLE.mailId] } }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("report", LINE),
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, declined: true, named: [] },
        },
    ],
})
