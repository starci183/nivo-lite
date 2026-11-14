import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CANDIDATES_MAX, type CustomerCandidate, customerCandidateSchema } from "./close-find.node"
import { type LinkBranch } from "./link-write.node"
import { ID_MAX, type TeamLocale, localeSchema } from "./sales-shapes"
import { type Posted, postArgsOf, postTeam, teamWordsSchema } from "./websales-calls"
import { POSTED } from "./websales.fixtures"
import { websalesText } from "../../modules/websales/copy"

/** The link's result, the candidates the find proposed, and the team's language. */
export type LinkNotifyInput = {
    /** Which way the link went, deciding the notice. */
    readonly branch: LinkBranch
    /** The lead the contact came from. */
    readonly leadId: string
    /** The customer the contact was linked to; null when none. */
    readonly customerCode: string | null
    /** The customers the contact may be, to be confirmed by a person. */
    readonly candidates: ReadonlyArray<CustomerCandidate>
    /** The language the team notice or customer text is written in. */
    readonly locale: TeamLocale
}

const ID = "websales.link-notify"

const input: z.ZodType<LinkNotifyInput> = z.object({
    branch: z.enum(["linked", "none"]),
    leadId: z.uuid(),
    customerCode: z.string().min(1).max(ID_MAX).nullable(),
    candidates: z.array(customerCandidateSchema).max(CANDIDATES_MAX),
    locale: localeSchema,
})

const output: z.ZodType<Posted> = z.object({ posted: z.boolean(), refusal: z.string().max(200).nullable() })

const GOAL =
    "Tell the team in ONE line, in the team's language (`locale`), the result of the link: linked, which lead was linked to which " +
    "customer of the CRM (`customerCode`, with its name from `candidates`); none, that no customer of the CRM was clearly this lead and " +
    "what a person can do (link it on the customer's page)."

/**
 * `websales.link-notify` (Bao doi ket qua lien ket): split from `websales.link-propose`, a side step (`blocking: false`): the agent
 * writes the team line, the node posts it (`TOOL.teamMessagePost`, NIVO's own): a notice when linked, a question when none fitted (the
 * intent follows the route in code). A refused post is returned, never a stop.
 */
export const websalesLinkNotifyNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: websalesText("node.link-notify.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i k\u1ebft qu\u1ea3 li\u00ean k\u1ebft kh\u00e1ch: \u0111\u00e3 li\u00ean k\u1ebft v\u1edbi ai, ho\u1eb7c ch\u01b0a t\u00ecm \u0111\u01b0\u1ee3c kh\u00e1ch ph\u00f9 h\u1ee3p.", en: "Tells the team the result of linking the customer: who they were linked to, or that no customer clearly matched." },
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
        return postTeam(context, { intent: given.branch === "linked" ? "notify" : "ask", ...words })
    },
    examples: [
        {
            name: "linked: tells the team which customer the lead is linked to",
            params: {},
            input: {
                branch: "linked",
                leadId: "2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182",
                customerCode: "KH-0042",
                candidates: [
                    { code: "KH-0042", name: "Cong ty TNHH Mau", why: "Cung so dien thoai 0900000001 voi khach." },
                ],
                locale: "vi",
            },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: postArgsOf({
                        intent: "notify",
                        title: "Da lien ket khach voi KH-0042",
                        text: "Khach 2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182 da duoc lien ket voi Cong ty TNHH Mau (KH-0042) trong CRM.",
                    }),
                    answer: POSTED,
                },
            ],
            agent: [
                {
                    answer: {
                        title: "Da lien ket khach voi KH-0042",
                        text: "Khach 2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182 da duoc lien ket voi Cong ty TNHH Mau (KH-0042) trong CRM.",
                    },
                },
            ],
            output: { posted: true, refusal: null },
        },
        {
            name: "none: asks the team, saying what a person can do",
            params: {},
            input: {
                branch: "none",
                leadId: "2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182",
                customerCode: null,
                candidates: [],
                locale: "vi",
            },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: postArgsOf({
                        intent: "ask",
                        title: "Chua tim thay khach trong CRM",
                        text: "Khong co khach nao trong CRM ro rang la khach 2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182. Neu biet khach nao, lien ket tren trang khach.",
                    }),
                    answer: POSTED,
                },
            ],
            agent: [
                {
                    answer: {
                        title: "Chua tim thay khach trong CRM",
                        text: "Khong co khach nao trong CRM ro rang la khach 2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182. Neu biet khach nao, lien ket tren trang khach.",
                    },
                },
            ],
            output: { posted: true, refusal: null },
        },
    ],
})
