import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { websalesText } from "../../modules/websales/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import {
    type DuePurchase,
    type HeldPurchase,
    ID_MAX,
    ROUND_MAX,
    type TeamLocale,
    crmChannelSchema,
    duePurchaseSchema,
    heldPurchaseSchema,
    heldWhySchema,
    localeSchema,
} from "./sales-shapes"
import { parsedOrCannot, valueOrCannot } from "./websales-calls"
import { CONVERSATION, crmAnswered, truthsOf } from "./websales.fixtures"

/** The language the team reads. */
export type DueInput = {
    /** The language the team notice is written in. */
    readonly locale: TeamLocale
}

/** The quoted purchases to follow up today and the ones held, each with why; `more` when the CRM had more than one page. */
export type DueOutput = {
    /** The items that are due this round. */
    readonly due: ReadonlyArray<DuePurchase>
    /** The items kept back from this round, with the reason for each. */
    readonly held: ReadonlyArray<HeldPurchase>
    /** True when more items are due than this round takes. */
    readonly more: boolean
}

const ID = "websales.due"

/** The CRM state of a purchase whose quote waits for an answer. */
const QUOTED = "quoted"

const day = z.string().max(40).nullable()

/** One row of the open purchases, as the CRM lists it (`PurchaseSummaryResponse`): the facts the rhythm is applied to. */
const rowSchema = z.looseObject({
    id: z.string().min(1).max(ID_MAX),
    code: z.string().min(1).max(ID_MAX),
    channel: crmChannelSchema,
    sourceRef: z.string().min(1).max(200),
    quotedOn: day,
    validUntil: day,
    lastFollowUpOn: day,
    followUpCount: z.number().int().nonnegative(),
    openFollowUp: z.boolean(),
    reachable: z.boolean(),
})

const pageSchema = z.looseObject({
    items: z.array(rowSchema).max(ROUND_MAX),
    nextCursor: z.string().max(2048).nullable(),
})

type Row = z.output<typeof rowSchema>

const input: z.ZodType<DueInput> = z.object({ locale: localeSchema })

const output: z.ZodType<DueOutput> = z.object({
    due: z.array(duePurchaseSchema).max(ROUND_MAX),
    held: z.array(heldPurchaseSchema).max(ROUND_MAX),
    more: z.boolean(),
})

const verdictSchema = z.object({
    due: z
        .array(z.string().min(1).max(ID_MAX))
        .max(ROUND_MAX)
        .describe("The `id` of every row the sales policy says to follow up today."),
    held: z
        .array(z.object({ id: z.string().min(1).max(ID_MAX), why: heldWhySchema }))
        .max(ROUND_MAX)
        .describe("Every row the policy would follow up today that cannot be followed up now, by its `id`, with why."),
})

const GOAL =
    "Find the quotes to follow up today. First search the company's truths for the sales policy: after how many days without an " +
    "answer a quote is followed up, how often it repeats, and when to stop and tell the team. Then apply the policy to the FACTS of each " +
    "row of `rows` (quotedOn, validUntil, lastFollowUpOn, followUpCount, openFollowUp, reachable) and today (`today`): the list gives " +
    "no verdict. A row the policy says to follow up today goes to `due` by its `id`; a row it would follow up but that cannot be now " +
    "goes to `held` with why; any other row is left out. When no truth gives the follow-up rhythm, or it is unclear, do not guess."

/** The facts of a row the rhythm is applied to, as the agent reads them (copied in code; members the CRM adds pass unread). */
const factsOf = (row: Row): JsonObject => ({
    id: row.id,
    code: row.code,
    channel: row.channel,
    quotedOn: row.quotedOn,
    validUntil: row.validUntil,
    lastFollowUpOn: row.lastFollowUpOn,
    followUpCount: row.followUpCount,
    openFollowUp: row.openFollowUp,
    reachable: row.reachable,
})

/** A row as the follow-up step takes it, copied in code (never by the model). */
const dueOf = (row: Row): DuePurchase => ({
    purchaseId: row.id,
    purchaseCode: row.code,
    channel: row.channel,
    sourceRef: row.sourceRef,
    quotedOn: row.quotedOn,
    validUntil: row.validUntil,
    lastFollowUpOn: row.lastFollowUpOn,
    followUpCount: row.followUpCount,
})

/**
 * `websales.due` (Tim bao gia chua tra loi): the node lists the quoted purchases (`purchase.open.list`, a read; one page of the
 * loop's cap), the agent reads the follow-up rhythm from the truths and applies it to the facts of each row and the run's day
 * (`ctx.run.day`), and the node copies the rows it named (an id it names that is not a row stops the step). No number of the
 * rhythm is in code. Writes nothing. `more` says the CRM had more quoted purchases than one round takes.
 */
export const websalesDueNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: websalesText("node.due.title"),
    description: { vi: "T\u00ecm c\u00e1c b\u00e1o gi\u00e1 ch\u01b0a \u0111\u01b0\u1ee3c kh\u00e1ch tr\u1ea3 l\u1eddi c\u1ea7n nh\u1eafc h\u00f4m nay, theo nh\u1ecbp nh\u1eafc c\u1ee7a c\u00f4ng ty; ch\u1ec9 \u0111\u1ecdc.", en: "Finds the quotes the customer has not answered that need a follow-up today, following the company's follow-up rhythm; read only." },
    tools: [CRM_NIVOWEB.get_purchases_open],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const answer = await context.tools.call(CRM_NIVOWEB.get_purchases_open, { state: QUOTED, limit: ROUND_MAX })
        const page = parsedOrCannot(
            context,
            CRM_NIVOWEB.get_purchases_open,
            pageSchema,
            valueOrCannot(context, CRM_NIVOWEB.get_purchases_open, answer),
        )
        const rows = new Map(page.items.map((row) => [row.id, row]))
        const verdict = await context.agent.run({
            goal: GOAL,
            input: { rows: page.items.map((entry) => factsOf(entry)), today: context.run.day, locale: given.locale },
            output: verdictSchema,
            tools: [],
            maxTurns: 4,
        })
        const rowOf = (id: string): Row =>
            rows.get(id) ?? context.fail({ kind: "cannot", why: `the verdict names ${id}, which is no row` })
        return {
            due: verdict.due.map((id) => dueOf(rowOf(id))),
            held: verdict.held.map((one) => {
                const row = rowOf(one.id)
                return { purchaseId: row.id, purchaseCode: row.code, why: one.why }
            }),
            more: page.nextCursor !== null,
        }
    },
    examples: [
        {
            name: "lists the quotes, reads the rhythm, follows up the one silent for three days and holds the one whose follow-up still waits",
            params: {},
            input: { locale: "vi" },
            tools: [
                {
                    id: CRM_NIVOWEB.get_purchases_open,
                    args: { state: "quoted", limit: 50 },
                    answer: crmAnswered({
                        items: [
                            {
                                id: "7c1d2e3f-0000-4000-8000-000000000021",
                                code: "MUA-7C1D2E3F",
                                state: "quoted",
                                channel: "zalo",
                                sourceRef: CONVERSATION,
                                customerCode: null,
                                quotedOn: "2026-11-09",
                                validUntil: "2026-11-23",
                                lastFollowUpOn: null,
                                followUpCount: 0,
                                openFollowUp: false,
                                reachable: true,
                            },
                            {
                                id: "7c1d2e3f-0000-4000-8000-000000000022",
                                code: "MUA-8D2E3F4A",
                                state: "quoted",
                                channel: "zalo",
                                sourceRef: CONVERSATION,
                                customerCode: null,
                                quotedOn: "2026-11-11",
                                validUntil: "2026-11-25",
                                lastFollowUpOn: null,
                                followUpCount: 0,
                                openFollowUp: false,
                                reachable: true,
                            },
                            {
                                id: "7c1d2e3f-0000-4000-8000-000000000023",
                                code: "MUA-9E3F4A5B",
                                state: "quoted",
                                channel: "zalo",
                                sourceRef: CONVERSATION,
                                customerCode: null,
                                quotedOn: "2026-11-06",
                                validUntil: "2026-11-23",
                                lastFollowUpOn: "2026-11-09",
                                followUpCount: 1,
                                openFollowUp: true,
                                reachable: true,
                            },
                        ],
                        nextCursor: null,
                    }),
                },
            ],
            agent: [
                {
                    answer: {
                        due: ["7c1d2e3f-0000-4000-8000-000000000021"],
                        held: [{ id: "7c1d2e3f-0000-4000-8000-000000000023", why: "open_followup" }],
                    },
                    calls: [
                        {
                            id: TOOL.brainSearch,
                            args: { query: "nhip nhac bao gia chua tra loi" },
                            answer: truthsOf([
                                {
                                    id: "f-sales-follow",
                                    text: "Bao gia chua tra loi: nhac sau 3 ngay, nhac lai moi 3 ngay; sau 3 lan thi dung va bao doi.",
                                },
                            ]),
                        },
                    ],
                },
            ],
            output: {
                due: [
                    {
                        purchaseId: "7c1d2e3f-0000-4000-8000-000000000021",
                        purchaseCode: "MUA-7C1D2E3F",
                        channel: "zalo",
                        sourceRef: CONVERSATION,
                        quotedOn: "2026-11-09",
                        validUntil: "2026-11-23",
                        lastFollowUpOn: null,
                        followUpCount: 0,
                    },
                ],
                held: [
                    {
                        purchaseId: "7c1d2e3f-0000-4000-8000-000000000023",
                        purchaseCode: "MUA-9E3F4A5B",
                        why: "open_followup",
                    },
                ],
                more: false,
            },
        },
        {
            name: "with no truth on the follow-up rhythm the agent cannot decide and the round stops",
            params: {},
            input: { locale: "vi" },
            tools: [
                {
                    id: CRM_NIVOWEB.get_purchases_open,
                    args: { state: "quoted", limit: 50 },
                    answer: crmAnswered({ items: [], nextCursor: null }),
                },
            ],
            agent: [
                {
                    fail: { kind: "confused", question: "Bao gia chua tra loi thi nhac sau bao nhieu ngay?" },
                    calls: [
                        {
                            id: TOOL.brainSearch,
                            args: { query: "nhip nhac bao gia chua tra loi" },
                            answer: truthsOf([]),
                        },
                    ],
                },
            ],
            failure: { kind: "confused", question: "Bao gia chua tra loi thi nhac sau bao nhieu ngay?" },
        },
    ],
})
