import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { LINE_MAX, idSchema, localeSchema } from "./books-shapes"
import { ownOk, refused } from "./books.fixtures"
import { postTeamLine, teamLineSchema, teamPostArgsOf } from "./team-line"
import { webbooksText } from "../../modules/webbooks/copy"

/**
 * The invoice as the issue answered it (`outcome`, the number, the refusal), and what became of the customer mail: `messageRef` /
 * `mailRefusal` absent (null) when the mail step did not run (a rejected or numberless issue, or no sending mailbox).
 */
const input = z.object({
    renewalId: idSchema,
    customerCode: idSchema,
    serviceCode: idSchema,
    invoiceNo: z.string().min(1).max(40).nullable(),
    // Null only when the issue was declined, a path that never reaches this step (a ref is not narrowed).
    outcome: z.enum(["issued", "rejected"]).nullable(),
    refusal: z.string().max(LINE_MAX).nullable().default(null),
    messageRef: idSchema.nullable().default(null),
    mailRefusal: z.string().max(LINE_MAX).nullable().default(null),
    locale: localeSchema,
})

const output = z.object({
    posted: z.boolean().describe("True once the line was posted to the team; false when a person declined it."),
    declined: z.boolean().describe("True when a person declined the team post on its card: nothing was posted."),
})

const GOAL =
    "Write ONE line for the team, in the team's language, about this renewal's invoice: the customer, the renewal's service and where " +
    "the invoice stands by `outcome`: `issued` with its number; `issued` with no number means the e-invoice service has not given the " +
    "number yet and a person checks it there; `rejected` means nothing was issued (the `refusal` says why) and a person must act. Say " +
    "whether the customer was mailed (a reference means it went; a refusal means it did not, and why; neither means no mail)."

const RENEWAL_ID = "5b0f3c1e-2d4a-4e6b-8c7d-9a0b1c2d3e4f"

const ISSUED_LINE = {
    title: "Da xuat hoa don gia han",
    text: "KH-0001 - gia han SITE1-HOST: hoa don 00000123 da xuat; thu gui khach da gui sau khi nguoi duyet.",
}

const NUMBERLESS_LINE = {
    title: "Hoa don gia han chua co so",
    text: "KH-0001 - gia han SITE1-HOST: hoa don da xuat nhung ben hoa don dien tu chua cap so; can nguoi kiem tra tren MISA, chua gui thu cho khach.",
}

const REJECTED_LINE = {
    title: "Hoa don gia han bi tu choi",
    text: "KH-0001 - gia han SITE1-HOST: ben hoa don dien tu tu choi (rejected), chua xuat hoa don; can nguoi xu ly.",
}

/**
 * `webbooks.invoice-team` (Tell the team about the invoice): split from `webbooks.invoice-notify`, on every path of the invoice
 * graph past the issue (issued with a number, issued without one yet, rejected: R57). The agent writes the line; the node posts it (`TOOL.teamMessagePost`, intent `report`). A side node
 * (`blocking: false`).
 */
export const webbooksInvoiceTeamNode: TemplateNode = defineTemplateNode({
    id: "webbooks.invoice-team",
    title: webbooksText("node.invoice-team.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i ho\u00e1 \u0111\u01a1n gia h\u1ea1n \u0111\u00e3 xu\u1ea5t (c\u00f3 s\u1ed1 hay ch\u01b0a) hay b\u1ecb t\u1eeb ch\u1ed1i, v\u00e0 th\u01b0 \u0111\u00e3 g\u1eedi kh\u00e1ch hay ch\u01b0a.", en: "Tells the team the renewal invoice was issued (with a number or not yet) or rejected, and whether the customer was mailed." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, ctx) => {
        const line = await ctx.agent.run({ goal: GOAL, input: given, output: teamLineSchema, maxTurns: 1, tools: [] })
        const post = await postTeamLine(ctx, "report", line)
        return { posted: !post.declined, declined: post.declined }
    },
    examples: [
        {
            name: "an issued invoice mailed to the customer: tells the team",
            params: {},
            input: {
                renewalId: RENEWAL_ID,
                customerCode: "KH-0001",
                serviceCode: "SITE1-HOST",
                invoiceNo: "00000123",
                outcome: "issued",
                messageRef: "mail-0002",
                locale: "vi",
            },
            agent: [{ answer: ISSUED_LINE }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("report", ISSUED_LINE),
                    answer: ownOk({ messageId: "team-message-3" }),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "a person declines the team post: nothing is posted and the step returns declined",
            params: {},
            input: {
                renewalId: RENEWAL_ID,
                customerCode: "KH-0001",
                serviceCode: "SITE1-HOST",
                invoiceNo: "00000123",
                outcome: "issued",
                messageRef: "mail-0002",
                locale: "vi",
            },
            agent: [{ answer: ISSUED_LINE }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("report", ISSUED_LINE),
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, declined: true },
        },
        {
            name: "issued without a number yet: no mail, tells the team a person checks it",
            params: {},
            input: {
                renewalId: RENEWAL_ID,
                customerCode: "KH-0001",
                serviceCode: "SITE1-HOST",
                invoiceNo: null,
                outcome: "issued",
                locale: "vi",
            },
            agent: [{ answer: NUMBERLESS_LINE }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("report", NUMBERLESS_LINE),
                    answer: ownOk({ messageId: "team-message-4" }),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "a rejected issue: nothing issued, no mail, tells the team a person acts",
            params: {},
            input: {
                renewalId: RENEWAL_ID,
                customerCode: "KH-0001",
                serviceCode: "SITE1-HOST",
                invoiceNo: null,
                outcome: "rejected",
                refusal: "rejected",
                locale: "vi",
            },
            agent: [{ answer: REJECTED_LINE }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamPostArgsOf("report", REJECTED_LINE),
                    answer: ownOk({ messageId: "team-message-5" }),
                },
            ],
            output: { posted: true, declined: false },
        },
    ],
})
