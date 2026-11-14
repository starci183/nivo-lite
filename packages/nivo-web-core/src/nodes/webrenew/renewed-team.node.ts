import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { refused, RENEWAL_ID, posted } from "./webrenew.examples"
import { z } from "zod"
import { type RenewOutput, renewOutputSchema } from "./renew.node"
import { type TeamLocale, localeSchema } from "./renew-shapes"
import { postTeam, teamLineSchema } from "./webrenew.calls"
import { webrenewText } from "../../modules/webrenew/copy"

/** The renewal as the provider step left it, the customer, and the team's language. */
type RenewedTeamInput = {
    readonly customerCode: string
    readonly renewal: RenewOutput
    readonly locale: TeamLocale
}

/** Whether the team was told: `posted` false and `declined` true when a person declined the post on its card. */
type RenewedTeamOutput = {
    readonly posted: boolean
    /** True when a person declined the team post on its card: the team was not told. */
    readonly declined: boolean
}

const ID = "webrenew.renewed-team"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<RenewedTeamInput> = z.object({
    customerCode: z.string().min(1).max(80),
    renewal: renewOutputSchema,
    locale: localeSchema,
})
const output: z.ZodType<RenewedTeamOutput> = z.object({
    posted: z.boolean(),
    declined: z.boolean().describe("True when a person declined the team post on its card: nothing was posted."),
})

const GOAL =
    "Tell the team where this renewal stands in ONE message in its language (`locale`): the customer, the service, the term, the state " +
    "exactly as given, and what a person must still do (a dry run or `pending_person` means a person renews at the provider and " +
    "confirms). Say the service is renewed only when `state` is `renewed`; never write a date the input does not give."

const TITLE = "Gia han EXAMPLE-TM cho nguoi lam"
const TEXT =
    "KH-001 da tra tien gia han EXAMPLE-TM 12 thang. Yeu cau o trang thai pending_person (chay thu): can nguoi gia han tai nha cung cap va xac nhan."

const GIVEN: RenewedTeamInput = {
    customerCode: "KH-001",
    renewal: {
        renewalId: RENEWAL_ID,
        serviceCode: "EXAMPLE-TM",
        termMonths: 12,
        state: "pending_person",
        dryRun: true,
        newExpiresOn: null,
    },
    locale: "vi",
}

/**
 * `webrenew.renewed-team` (Tell the team where the renewal stands): after the provider step, the agent writes the team's one line
 * (the state as the CRM answered it, what a person must still do) and the step posts it. Blocking: a renewal never ends unseen,
 * so a refused post stops the run (the engine reports it).
 */
export const webrenewRenewedTeamNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.renewedTeam.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i m\u1ed9t d\u00f2ng v\u1ec1 t\u00ecnh tr\u1ea1ng gia h\u1ea1n v\u00e0 vi\u1ec7c ng\u01b0\u1eddi c\u00f2n ph\u1ea3i l\u00e0m.", en: "Tells the team in one line where the renewal stands and what a person still has to do." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const line = await context.agent.run({ goal: GOAL, input: given, output: teamLineSchema, maxTurns: 1 })
        const post = await postTeam(context, "notify", line)
        if (!post.ok) {
            if (post.declined === true) return { posted: false, declined: true }
            return context.fail({ kind: "cannot", why: `team_post_refused:${post.refusal}` }, post.facts)
        }
        return { posted: true, declined: false }
    },
    examples: [
        {
            name: "a dry-run renewal waiting for a person: tells the team what is left",
            params: {},
            input: GIVEN,
            agent: [{ answer: { title: TITLE, text: TEXT } }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: { kind: "message.text", intent: "notify", title: TITLE, text: TEXT },
                    answer: posted("m-team-6"),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "a person declines the team post: nothing is posted and the step returns declined",
            params: {},
            input: GIVEN,
            agent: [{ answer: { title: TITLE, text: TEXT } }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: { kind: "message.text", intent: "notify", title: TITLE, text: TEXT },
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, declined: true },
        },
        {
            name: "a refused post stops the run: a renewal never ends unseen",
            params: {},
            input: GIVEN,
            agent: [{ answer: { title: TITLE, text: TEXT } }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: { kind: "message.text", intent: "notify", title: TITLE, text: TEXT },
                    answer: refused("other_room"),
                },
            ],
            failure: { kind: "cannot", why: "team_post_refused:other_room" },
        },
    ],
})
