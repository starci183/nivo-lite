import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { ID_MAX, type TeamLocale, lineSchema, localeSchema } from "./sales-shapes"
import { type Posted, postArgsOf, postTeam, teamWordsSchema } from "./websales-calls"
import { POSTED, PURCHASE_CODE } from "./websales.fixtures"
import { websalesText } from "../../modules/websales/copy"

/** The purchase closed as lost, what the person wanted, and why they stop. */
export type LostNotifyInput = {
    /** The CRM code of the purchase, as the team reads it. */
    readonly purchaseCode: string
    /** A one-line summary of what was said, kept for the team notice and later steps. */
    readonly summary: string
    /** The reason given. */
    readonly reason: string
    /** The language the team notice or customer text is written in. */
    readonly locale: TeamLocale
}

const ID = "websales.lost-notify"

const input: z.ZodType<LostNotifyInput> = z.object({
    purchaseCode: z.string().min(1).max(ID_MAX),
    summary: lineSchema,
    reason: lineSchema,
    locale: localeSchema,
})

const output: z.ZodType<Posted> = z.object({ posted: z.boolean(), refusal: z.string().max(200).nullable() })

const GOAL =
    "Tell the team in ONE line, in the team's language (`locale`): the `purchaseCode`, what the person wanted (`summary`) and why they " +
    "stop (`reason`), and that the purchase is closed. The title holds the `purchaseCode`."

/**
 * `websales.lost-notify` (Bao doi khong mua): split from `websales.lost`, a side step (`blocking: false`): the agent writes the
 * team line, the node posts it as a notice (`TOOL.teamMessagePost`, NIVO's own). A refused post is returned, never a stop.
 */
export const websalesLostNotifyNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: websalesText("node.lost-notify.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i kh\u00e1ch kh\u00f4ng mua, k\u00e8m l\u00fd do, v\u00e0 \u0111\u01a1n \u0111\u00e3 \u0111\u01b0\u1ee3c \u0111\u00f3ng.", en: "Tells the team the customer is not buying, with the reason, and that the purchase is closed." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, context) => {
        const words = await context.agent.run({
            goal: GOAL,
            input: given,
            output: teamWordsSchema,
            tools: [],
            maxTurns: 1,
        })
        return postTeam(context, { intent: "notify", ...words })
    },
    examples: [
        {
            name: "tells the team the purchase is closed and why",
            params: {},
            input: {
                purchaseCode: PURCHASE_CODE,
                summary: "Khach khong lam website nua vi chua co ngan sach.",
                reason: "Chua co ngan sach nam nay.",
                locale: "vi",
            },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: postArgsOf({
                        intent: "notify",
                        title: "MUA-7C1D2E3F: khach khong mua",
                        text: "MUA-7C1D2E3F (website ban hang): khach khong lam nua vi chua co ngan sach nam nay. Da dong yeu cau.",
                    }),
                    answer: POSTED,
                },
            ],
            agent: [
                {
                    answer: {
                        title: "MUA-7C1D2E3F: khach khong mua",
                        text: "MUA-7C1D2E3F (website ban hang): khach khong lam nua vi chua co ngan sach nam nay. Da dong yeu cau.",
                    },
                },
            ],
            output: { posted: true, refusal: null },
        },
    ],
})
