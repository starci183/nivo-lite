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
    "Tell the team where this renewal stands in ONE message in its language (`locale`): the customer, the service, the term, the " +
    "`outcome` exactly as given and what a person must still do. Say the service is renewed only when `outcome` is `renewed` (with " +
    "`newExpiresOn` as given). `pending`: the registrar took the order (`reference`) but the end date has not moved; a person checks the " +
    "order later. `refused`: the registrar refused (`reason`), nothing was renewed and the customer has paid; a person tops up the " +
    "registrar balance or renews by hand. `not_renewable`: no registrar tool renews this service (`reason`); a person renews it by hand. " +
    "Never write a date the input does not give."

/** One example renewal of the service, by its outcome. */
const RENEWED: RenewOutput = {
    renewalId: RENEWAL_ID,
    serviceCode: "EXAMPLE-TM",
    termMonths: 12,
    outcome: "renewed",
    reason: null,
    reference: "INET-ORD-7781",
    provider: "inet",
    newExpiresOn: "2027-12-12",
    expiresBefore: "2026-12-12",
}
const PENDING: RenewOutput = { ...RENEWED, outcome: "pending", newExpiresOn: null }
const REFUSED: RenewOutput = {
    ...RENEWED,
    outcome: "refused",
    reason: "insufficient_balance",
    reference: null,
    provider: null,
    newExpiresOn: null,
    expiresBefore: null,
}

const RENEWED_LINE = {
    title: "Da gia han EXAMPLE-TM",
    text: "KH-001: ten mien EXAMPLE-TM da gia han 12 thang tai iNET (don INET-ORD-7781), het han moi 2027-12-12.",
}
const PENDING_LINE = {
    title: "Gia han EXAMPLE-TM dang cho nha dang ky",
    text: "KH-001: iNET da nhan don INET-ORD-7781 gia han EXAMPLE-TM 12 thang nhung ngay het han chua doi; can nguoi kiem tra lai don sau.",
}
const REFUSED_LINE = {
    title: "Gia han EXAMPLE-TM bi tu choi",
    text: "KH-001 da tra tien gia han EXAMPLE-TM 12 thang nhung nha dang ky tu choi (insufficient_balance): can nguoi nap tien va gia han tay.",
}

const GIVEN: RenewedTeamInput = { customerCode: "KH-001", renewal: RENEWED, locale: "vi" }

/** The post a line becomes. */
const postOf = (line: { readonly title: string; readonly text: string }) => ({
    kind: "message.text",
    intent: "notify",
    title: line.title,
    text: line.text,
})

/**
 * `webrenew.renewed-team` (Tell the team where the renewal stands): after the registrar step and its record, on EVERY path (R57), the
 * agent writes the team's one line (the outcome as the registrar answered it, what a person must still do) and the step posts it.
 * Blocking: a renewal never ends unseen, so a refused post stops the run (the engine reports it).
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
            name: "a renewed domain: tells the team the new end date",
            params: {},
            input: GIVEN,
            agent: [{ answer: RENEWED_LINE }],
            tools: [{ id: TOOL.teamMessagePost, args: postOf(RENEWED_LINE), answer: posted("m-team-6") }],
            output: { posted: true, declined: false },
        },
        {
            name: "an order the registrar has not moved yet: tells the team a person checks it later",
            params: {},
            input: { ...GIVEN, renewal: PENDING },
            agent: [{ answer: PENDING_LINE }],
            tools: [{ id: TOOL.teamMessagePost, args: postOf(PENDING_LINE), answer: posted("m-team-7") }],
            output: { posted: true, declined: false },
        },
        {
            name: "a refused renewal: tells the team a person tops up and renews by hand",
            params: {},
            input: { ...GIVEN, renewal: REFUSED },
            agent: [{ answer: REFUSED_LINE }],
            tools: [{ id: TOOL.teamMessagePost, args: postOf(REFUSED_LINE), answer: posted("m-team-8") }],
            output: { posted: true, declined: false },
        },
        {
            name: "a person declines the team post: nothing is posted and the step returns declined",
            params: {},
            input: GIVEN,
            agent: [{ answer: RENEWED_LINE }],
            tools: [{ id: TOOL.teamMessagePost, args: postOf(RENEWED_LINE), answer: refused("declined") }],
            output: { posted: false, declined: true },
        },
        {
            name: "a refused post stops the run: a renewal never ends unseen",
            params: {},
            input: GIVEN,
            agent: [{ answer: RENEWED_LINE }],
            tools: [{ id: TOOL.teamMessagePost, args: postOf(RENEWED_LINE), answer: refused("other_room") }],
            failure: { kind: "cannot", why: "team_post_refused:other_room" },
        },
    ],
})
