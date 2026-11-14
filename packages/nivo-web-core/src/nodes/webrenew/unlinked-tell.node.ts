import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { refused, LEAD_ID, posted } from "./webrenew.examples"
import { z } from "zod"
import { lineSchema, optionalId } from "./answer-shapes"
import { type TeamLocale, localeSchema } from "./renew-shapes"
import { postTeam, teamLineSchema } from "./webrenew.calls"
import { webrenewText } from "../../modules/webrenew/copy"

/** The lead whose conversation is linked to no CRM customer, the team's line about what they said, and the team's language. */
type UnlinkedTellInput = {
    readonly contactId: string | null
    readonly summary: string
    readonly locale: TeamLocale
}

/** Whether the team was told, and the post's refusal. */
type UnlinkedTellOutput = {
    readonly posted: boolean
    readonly refusal: string | null
}

const ID = "webrenew.unlinked-tell"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<UnlinkedTellInput> = z.object({ contactId: optionalId, summary: lineSchema, locale: localeSchema })
const output: z.ZodType<UnlinkedTellOutput> = z.object({
    posted: z.boolean(),
    refusal: z.string().min(1).max(100).nullable(),
})

const GOAL =
    "A customer whose conversation is linked to no CRM customer wrote about a renewal; they were answered. Write ONE message for the " +
    "team in its language (`locale`): the customer is not linked to the CRM (kh\u00e1ch ch\u01b0a li\u00ean k\u1ebft CRM), the lead (`contactId`, as given), " +
    'what they said (`summary`), and that a person starts "Li\u00ean k\u1ebft kh\u00e1ch" by writing this lead to the Sales agent (Kinh doanh) in the ' +
    "team chat."

const TITLE = "Khach chua lien ket CRM muon gia han"
const TEXT =
    `Khach chua lien ket CRM (lead ${LEAD_ID}) muon gia han ten mien them 1 nam. ` +
    `De lien ket khach, nhan cho Kinh doanh trong chat doi: lien ket khach ${LEAD_ID}.`

const GIVEN: UnlinkedTellInput = {
    contactId: LEAD_ID,
    summary: "Khach muon gia han them 1 nam; hoi thoai chua lien ket voi khach nao trong CRM.",
    locale: "vi",
}

/**
 * `webrenew.unlinked-tell` (Tell the team to link the customer): a side step (`blocking: false`) reached only when the customer
 * is linked to no CRM customer (an `ifNode` on the understood `customerCode`). The agent writes the one team line; the step posts
 * it to the agent's own people. The run serves the customer's conversation, so it never links the customer itself. A refused post
 * is said in the output.
 */
export const webrenewUnlinkedTellNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.unlinkedTell.title"),
    description: { vi: "Nh\u1edd \u0111\u1ed9i li\u00ean k\u1ebft kh\u00e1ch n\u00e0y v\u1edbi h\u1ed3 s\u01a1 kh\u00e1ch h\u00e0ng v\u00ec ch\u01b0a bi\u1ebft h\u1ecd l\u00e0 ai trong h\u1ec7 th\u1ed1ng.", en: "Asks the team to link this customer to a customer record because we do not yet know who they are in the system." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, context) => {
        const line = await context.agent.run({ goal: GOAL, input: given, output: teamLineSchema, maxTurns: 1 })
        const post = await postTeam(context, "ask", line, "own")
        return post.ok ? { posted: true, refusal: null } : { posted: false, refusal: post.declined === true ? "declined" : post.refusal }
    },
    examples: [
        {
            name: "tells the team which lead to link and how a person starts it",
            params: {},
            input: GIVEN,
            agent: [{ answer: { title: TITLE, text: TEXT } }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: { kind: "message.text", intent: "ask", audience: "own", title: TITLE, text: TEXT },
                    answer: posted("m-team-3"),
                },
            ],
            output: { posted: true, refusal: null },
        },
        {
            name: "a refused post is said in the output",
            params: {},
            input: GIVEN,
            agent: [{ answer: { title: TITLE, text: TEXT } }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: { kind: "message.text", intent: "ask", audience: "own", title: TITLE, text: TEXT },
                    answer: refused("other_room"),
                },
            ],
            output: { posted: false, refusal: "other_room" },
        },
    ],
})
