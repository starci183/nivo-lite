import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { websalesText } from "../../modules/websales/copy"
import {
    type HeldPurchase,
    ID_MAX,
    ROUND_MAX,
    type SentFollowUp,
    type TeamLocale,
    heldPurchaseSchema,
    localeSchema,
    sentFollowUpSchema,
} from "./sales-shapes"
import { postArgsOf, postTeam, teamWordsSchema } from "./websales-calls"
import { POSTED, truthsOf } from "./websales.fixtures"

/**
 * One item of the round's loop as the loop answers it: the item's key and the collected output (the send step's, which every item
 * reaches, so an item not sent carries its why in `refusal`); null only when that step answered nothing for the item.
 */
export type RoundItem = {
    /** The key of the purchase the follow-up was for. */
    readonly key: string
    /** What the follow-up step returned; null when it did not run. */
    readonly output: SentFollowUp | null
}

/** The items the loop did not start past its cap (contract C4), or null. */
export type RoundCapped = {
    /** How many follow-ups were left for the next round. */
    readonly count: number
    /** The key of the first item left out. */
    readonly firstKey: string
}

/** The round's items, the purchases held, whether the CRM had more than one round, and the team's language. */
export type RoundReportInput = {
    /** The rows this step works on, in order. */
    readonly items: ReadonlyArray<RoundItem>
    /** The cap that cut this round short; null when none. */
    readonly capped: RoundCapped | null
    /** The purchases kept back from this round. */
    readonly held: ReadonlyArray<HeldPurchase>
    /** True when more rows exist than this round takes. */
    readonly more: boolean
    /** The language the team notice or customer text is written in. */
    readonly locale: TeamLocale
}

/** Whether the team was told, and the purchase codes of the round: followed up, and held. */
export type RoundReportOutput = {
    /** True when the team notice was posted. */
    readonly posted: boolean
    /** The purchases that were followed up. */
    readonly followed: ReadonlyArray<string>
    /** The purchases kept back from this round. */
    readonly held: ReadonlyArray<string>
}

const ID = "websales.round-report"

const codes = z.array(z.string().min(1).max(ID_MAX)).max(ROUND_MAX)

const input: z.ZodType<RoundReportInput> = z.object({
    items: z
        .array(z.object({ key: z.string().min(1).max(ID_MAX), output: sentFollowUpSchema.nullable() }))
        .max(ROUND_MAX),
    capped: z.object({ count: z.number().int().positive(), firstKey: z.string().min(1).max(ID_MAX) }).nullable(),
    held: z.array(heldPurchaseSchema).max(ROUND_MAX),
    more: z.boolean(),
    locale: localeSchema,
})

const output: z.ZodType<RoundReportOutput> = z.object({ posted: z.boolean(), followed: codes, held: codes })

const GOAL =
    "Tell the team the result of this morning's quote follow-ups in ONE message, in the team's language (`locale`): each follow-up " +
    "with its purchase code and channel (`email` is a mail draft waiting for a person to send it), then each held purchase with why, so " +
    "a person acts on it (a quote the policy says to stop on, or one that no longer holds, is a person's to close or quote again). An " +
    "item whose output says `sent` false (with its `refusal`), or whose output is null, is a purchase the round could not follow up: " +
    "say so with why, so a person looks (`declined` true: a person of the team declined that reminder, their decision). `capped` and `more` say the round " +
    "did not reach every quote: say how many wait. You may search the truths for who in the team takes new sales and name them."

/**
 * `websales.round-report` (Bao doi): the last step of the round, a side step (`blocking: false`). With nothing followed up,
 * nothing held and nothing left over it posts nothing and calls no model (an exact check); otherwise the agent writes ONE report
 * and the node posts it (`TOOL.teamMessagePost`, NIVO's own). The codes of its output are the round's own, read in code from the
 * loop's items and the held list.
 */
export const websalesRoundReportNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: websalesText("node.round-report.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i k\u1ebft qu\u1ea3 \u0111\u1ee3t nh\u1eafc b\u00e1o gi\u00e1 s\u00e1ng nay: \u0111\u01a1n \u0111\u00e3 nh\u1eafc, \u0111\u01a1n t\u1ea1m gi\u1eef v\u00e0 s\u1ed1 \u0111\u01a1n c\u00f2n l\u1ea1i.", en: "Tells the team how this morning's quote follow-ups went: the purchases followed up, held, and how many are left over." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, context) => {
        const followed = given.items.flatMap((item) =>
            !item.output?.sent ? [] : [item.output.purchaseCode],
        )
        const held = given.held.map((one) => one.purchaseCode)
        if (given.items.length === 0 && held.length === 0 && given.capped === null && !given.more) {
            return { posted: false, followed, held }
        }
        const words = await context.agent.run({
            goal: GOAL,
            input: {
                items: given.items.map((one) => ({ key: one.key, output: one.output })),
                capped: given.capped,
                held: given.held.map((one) => ({ ...one })),
                more: given.more,
                locale: given.locale,
            },
            output: teamWordsSchema,
            tools: [],
            maxTurns: 3,
        })
        const posted = await postTeam(context, { intent: "report", ...words })
        return { posted: posted.posted, followed, held }
    },
    examples: [
        {
            name: "names the follow-up and the held purchase in one team message",
            params: {},
            input: {
                items: [
                    {
                        key: "7c1d2e3f-0000-4000-8000-000000000021",
                        output: {
                            purchaseId: "7c1d2e3f-0000-4000-8000-000000000021",
                            purchaseCode: "MUA-7C1D2E3F",
                            sent: true,
                            recordChannel: "zalo",
                            channel: "zalo",
                            messageRef: "msg-11",
                            refusal: null,
                            declined: false,
                        },
                    },
                ],
                capped: null,
                held: [
                    {
                        purchaseId: "7c1d2e3f-0000-4000-8000-000000000023",
                        purchaseCode: "MUA-9E3F4A5B",
                        why: "open_followup",
                    },
                ],
                more: false,
                locale: "vi",
            },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: postArgsOf({
                        intent: "report",
                        title: "Nhac bao gia sang nay",
                        text: "Da nhac: MUA-7C1D2E3F qua Zalo (cho nguoi duyet tin).\nGiu lai: MUA-9E3F4A5B - lan nhac truoc van chua duoc tra loi.",
                    }),
                    answer: POSTED,
                },
            ],
            agent: [
                {
                    answer: {
                        title: "Nhac bao gia sang nay",
                        text: "Da nhac: MUA-7C1D2E3F qua Zalo (cho nguoi duyet tin).\nGiu lai: MUA-9E3F4A5B - lan nhac truoc van chua duoc tra loi.",
                    },
                    calls: [{ id: TOOL.brainSearch, args: { query: "ai phu trach khach moi" }, answer: truthsOf([]) }],
                },
            ],
            output: { posted: true, followed: ["MUA-7C1D2E3F"], held: ["MUA-9E3F4A5B"] },
        },
        {
            name: "posts nothing and calls no model on a morning with nothing followed up and nothing held",
            params: {},
            input: { items: [], capped: null, held: [], more: false, locale: "vi" },
            output: { posted: false, followed: [], held: [] },
        },
        {
            name: "an item that was not sent is no follow-up: the report names it with why for a person to look at",
            params: {},
            input: {
                items: [
                    {
                        key: "7c1d2e3f-0000-4000-8000-000000000022",
                        output: {
                            purchaseId: "7c1d2e3f-0000-4000-8000-000000000022",
                            purchaseCode: "MUA-8D2E3F4A",
                            sent: false,
                            recordChannel: null,
                            channel: null,
                            messageRef: null,
                            refusal: "no_contact",
                            declined: false,
                        },
                    },
                ],
                capped: null,
                held: [],
                more: false,
                locale: "vi",
            },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: postArgsOf({
                        intent: "report",
                        title: "Nhac bao gia sang nay",
                        text: "Khong nhac duoc MUA-8D2E3F4A: don mua khong co cach lien lac voi khach, can nguoi xem.",
                    }),
                    answer: POSTED,
                },
            ],
            agent: [
                {
                    answer: {
                        title: "Nhac bao gia sang nay",
                        text: "Khong nhac duoc MUA-8D2E3F4A: don mua khong co cach lien lac voi khach, can nguoi xem.",
                    },
                },
            ],
            output: { posted: true, followed: [], held: [] },
        },
        {
            name: "an item the round could not follow up is reported for a person to look at",
            params: {},
            input: {
                items: [{ key: "7c1d2e3f-0000-4000-8000-000000000022", output: null }],
                capped: null,
                held: [],
                more: false,
                locale: "vi",
            },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: postArgsOf({
                        intent: "report",
                        title: "Nhac bao gia sang nay",
                        text: "Khong nhac duoc 1 bao gia (7c1d2e3f-0000-4000-8000-000000000022): can nguoi xem.",
                    }),
                    answer: POSTED,
                },
            ],
            agent: [
                {
                    answer: {
                        title: "Nhac bao gia sang nay",
                        text: "Khong nhac duoc 1 bao gia (7c1d2e3f-0000-4000-8000-000000000022): can nguoi xem.",
                    },
                },
            ],
            output: { posted: true, followed: [], held: [] },
        },
    ],
})
