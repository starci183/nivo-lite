import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { LINE_MAX, idSchema, localeSchema } from "./books-shapes"
import { ownOk, refused } from "./books.fixtures"
import { postTeamLine, teamLineSchema, teamPostArgsOf } from "./team-line"
import { webbooksText } from "../../modules/webbooks/copy"

/**
 * The recorded renewal payment: whose, which service, which bank row, the CRM's state, and the settle step's line when it judged.
 */
const input = z.object({
    customerCode: idSchema,
    // Named on the renewal route (the settle step's output says so); a route does not narrow a ref, so it is typed nullable.
    serviceCode: idSchema.nullable(),
    transactionRef: idSchema,
    // Answered by the record step on its paid path (a decline routes away before this step); a ref is not narrowed, so typed nullable.
    state: z.string().min(1).max(40).nullable(),
    reason: z.string().max(LINE_MAX).nullable().default(null),
    locale: localeSchema,
})

const output = z.object({
    posted: z.boolean().describe("True once the line was posted to the team; false when a person declined it."),
    declined: z.boolean().describe("True when a person declined the team post on its card: nothing was posted."),
})

const GOAL =
    "Write ONE line for the team, in the team's language, that a renewal payment was recorded: the customer, the service, the bank row " +
    "and the state the CRM answered; when a reason is given (a truth of the company settled a difference), say it. No amount."

const LINE = {
    title: "Da nhan tien gia han",
    text: "KH-0001 - SITE1-HOST: giao dich tx-0077 da duoc ghi nhan cho yeu cau gia han, trang thai paid.",
}

/**
 * `webbooks.renewal-paid-team` (Tell the team the renewal is paid): split from `webbooks.payment-record`. The agent writes the
 * line; the node posts it (`TOOL.teamMessagePost`, intent `notify`). A side node (`blocking: false`): the hand-off to the
 * provider renewal goes on whatever becomes of the post.
 */
export const webbooksRenewalPaidTeamNode: TemplateNode = defineTemplateNode({
    id: "webbooks.renewal-paid-team",
    title: webbooksText("node.renewal-paid-team.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i \u0111\u00e3 nh\u1eadn ti\u1ec1n gia h\u1ea1n.", en: "Tells the team the renewal payment has been received." },
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
            name: "tells the team the request was recorded paid by the bank row",
            params: {},
            input: {
                customerCode: "KH-0001",
                serviceCode: "SITE1-HOST",
                transactionRef: "tx-0077",
                state: "paid",
                locale: "vi",
            },
            agent: [{ answer: LINE }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("notify", LINE),
                    answer: ownOk({ messageId: "team-message-5" }),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "a person declines the team post: nothing is posted and the step returns declined",
            params: {},
            input: {
                customerCode: "KH-0001",
                serviceCode: "SITE1-HOST",
                transactionRef: "tx-0077",
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
