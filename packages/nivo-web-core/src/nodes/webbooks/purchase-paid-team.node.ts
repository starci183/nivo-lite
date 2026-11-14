import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { LINE_MAX, idSchema, localeSchema } from "./books-shapes"
import { ownOk, refused } from "./books.fixtures"
import { postTeamLine, teamLineSchema, teamPostArgsOf } from "./team-line"
import { webbooksText } from "../../modules/webbooks/copy"

/**
 * The recorded purchase payment: whose, the purchase's code, which bank row, the CRM's state, and the settle step's line if it
 * judged.
 */
const input = z.object({
    customerCode: idSchema,
    // Answered by the record step on its paid path (a decline routes away before this step); a ref is not narrowed, so typed nullable.
    code: idSchema.nullable(),
    transactionRef: idSchema,
    state: z.string().min(1).max(40).nullable(),
    reason: z.string().max(LINE_MAX).nullable().default(null),
    locale: localeSchema,
})

const output = z.object({
    posted: z.boolean().describe("True once the line was posted to the team; false when a person declined it."),
    declined: z.boolean().describe("True when a person declined the team post on its card: nothing was posted."),
})

const GOAL =
    "Write ONE line for the team, in the team's language, that a purchase payment was recorded: the customer, the purchase's code, the " +
    "bank row and the state the CRM answered; when a reason is given (a truth of the company settled a difference), say it. No amount."

const LINE = {
    title: "Da nhan tien don mua",
    text: "KH-0142 - MUA-0007: giao dich tx-0090 da duoc ghi nhan cho don mua, trang thai paid.",
}

/**
 * `webbooks.purchase-paid-team` (Tell the team the purchase is paid): split from `webbooks.purchase-record`. The agent writes the
 * line; the node posts it (`TOOL.teamMessagePost`, intent `notify`). A side node (`blocking: false`): the hand-off to Sales goes
 * on whatever becomes of the post.
 */
export const webbooksPurchasePaidTeamNode: TemplateNode = defineTemplateNode({
    id: "webbooks.purchase-paid-team",
    title: webbooksText("node.purchase-paid-team.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i \u0111\u00e3 nh\u1eadn ti\u1ec1n cho \u0111\u01a1n mua.", en: "Tells the team the money for a purchase has been received." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, ctx) => {
        const line = await ctx.agent.run({ goal: GOAL, input: given, output: teamLineSchema, maxTurns: 1, tools: [] })
        const post = await postTeamLine(ctx, "notify", line)
        return { posted: !post.declined, declined: post.declined }
    },
    examples: [
        {
            name: "tells the team the purchase was recorded paid by the bank row",
            params: {},
            input: {
                customerCode: "KH-0142",
                code: "MUA-0007",
                transactionRef: "tx-0090",
                state: "paid",
                locale: "vi",
            },
            agent: [{ answer: LINE }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("notify", LINE),
                    answer: ownOk({ messageId: "team-message-6" }),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "a person declines the team post: nothing is posted and the step returns declined",
            params: {},
            input: {
                customerCode: "KH-0142",
                code: "MUA-0007",
                transactionRef: "tx-0090",
                state: "paid",
                locale: "vi",
            },
            agent: [{ answer: LINE }],
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
