import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { refused, ZALO, posted } from "./webrenew.examples"
import { z } from "zod"
import { webrenewText } from "../../modules/webrenew/copy"
import {
    type HeldService,
    type LoopOutput,
    ROUND_SERVICES_MAX,
    type SentReminder,
    type TeamLocale,
    heldServiceSchema,
    localeSchema,
    loopOutputSchema,
    sentReminderSchema,
} from "./renew-shapes"
import { MAIL_CHANNEL, postTeam, teamLineSchema } from "./webrenew.calls"

/**
 * The round's loop output (one item per due service, the record's output or null), the services held, and the team's language.
 */
type RoundReportInput = {
    readonly reminded: LoopOutput<SentReminder>
    readonly held: ReadonlyArray<HeldService>
    readonly locale: TeamLocale
}

/**
 * What the step did: whether it told the team, and the services the round reminded (and recorded), reminded but did not record (a
 * person declined the record), could not remind, and held.
 */
type RoundReportOutput = {
    readonly posted: boolean
    readonly reminded: ReadonlyArray<string>
    readonly notRecorded: ReadonlyArray<string>
    readonly notReminded: ReadonlyArray<string>
    readonly held: ReadonlyArray<string>
    readonly refusal: string | null
}

const ID = "webrenew.round-report"

const codes = z.array(z.string().min(1).max(120)).max(ROUND_SERVICES_MAX)

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<RoundReportInput> = z.object({
    reminded: loopOutputSchema(sentReminderSchema),
    held: z.array(heldServiceSchema).max(ROUND_SERVICES_MAX),
    locale: localeSchema,
})
const output: z.ZodType<RoundReportOutput> = z.object({
    posted: z.boolean(),
    reminded: codes,
    notRecorded: codes,
    notReminded: codes,
    held: codes,
    refusal: z.string().min(1).max(100).nullable(),
})

const GOAL =
    "Write ONE message telling the team the result of this morning's renewal round, in the team's language (`locale`): each reminder " +
    "with its service and the channel it went through (a mail is a draft waiting for a person to send it), each service reminded but " +
    "not recorded because a person declined the record (`notRecorded`), each service the round could not remind (`notReminded`) so a " +
    "person looks, the services past the round's cap (`overCap`) if any, then each held service " +
    "with why, so a person acts on it. You may search the truths for who in the team takes renewals and name them."

/**
 * `webrenew.round-report` (Tell the team the result): a side step (`blocking: false`) after the round's loop. The step works out
 * in code, from the loop's output, which services were reminded and recorded, which were reminded but not recorded (the record's
 * output says `declined`: a person declined it), which the loop could not remind (an item whose output is null: its reminder did
 * not go out, a person's decline of the send included, so it never reached the record) and
 * which were past the cap; a morning with nothing to say posts nothing and calls no AI. Otherwise the agent writes the one team
 * message and the step posts it. A refused post is said in the output; the reminders already went out.
 */
export const webrenewRoundReportNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.roundReport.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i k\u1ebft qu\u1ea3 \u0111\u1ee3t nh\u1eafc gia h\u1ea1n s\u00e1ng nay: d\u1ecbch v\u1ee5 \u0111\u00e3 nh\u1eafc, ch\u01b0a nh\u1eafc \u0111\u01b0\u1ee3c v\u00e0 c\u1ea7n ng\u01b0\u1eddi xem l\u1ea1i.", en: "Tells the team how this morning's renewal reminders went: who was reminded, who could not be, and what needs a person." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, context) => {
        // An item with no record (`output` null: its reminder did not go out, so the round's `sent` check ended it) was not reminded.
        const sent: ReadonlyArray<SentReminder> = given.reminded.items.flatMap((item) =>
            item.output === null ? [] : [item.output],
        )
        const recorded = sent.filter((one) => !one.declined)
        const notRecorded = sent.filter((one) => one.declined).map((one) => one.serviceCode)
        const notReminded = given.reminded.items.filter((item) => item.output === null).map((item) => item.key)
        const held = given.held.map((one) => one.serviceCode)
        const counts = { reminded: recorded.map((one) => one.serviceCode), notRecorded, notReminded, held }
        if (given.reminded.items.length === 0 && given.reminded.held === null && held.length === 0) {
            return { posted: false, ...counts, refusal: null }
        }
        const line = await context.agent.run({
            goal: GOAL,
            input: {
                reminders: recorded,
                notRecorded,
                notReminded,
                overCap: given.reminded.held,
                held: given.held,
                locale: given.locale,
            },
            output: teamLineSchema,
            tools: [],
            maxTurns: 3,
        })
        const post = await postTeam(context, "report", line)
        return post.ok
            ? { posted: true, ...counts, refusal: null }
            : { posted: false, ...counts, refusal: post.declined === true ? "declined" : post.refusal }
    },
    examples: [
        {
            name: "names the reminder and the held service in one team message",
            params: {},
            input: {
                reminded: {
                    items: [
                        {
                            key: "EXAMPLE-TM",
                            output: {
                                serviceCode: "EXAMPLE-TM",
                                channel: MAIL_CHANNEL,
                                declined: false,
                                reminderId: "9a1b2c3d-0000-4000-8000-000000000002",
                            },
                        },
                    ],
                    held: null,
                },
                held: [{ serviceCode: "DEMO-SSL", customerCode: "KH-003", why: "estimated" }],
                locale: "vi",
            },
            agent: [
                {
                    answer: {
                        title: "Nhac gia han sang nay",
                        text:
                            "Da nhac: EXAMPLE-TM qua thu (ban nhap cho nguoi gui).\n" +
                            "Giu lai: DEMO-SSL - ngay het han la uoc tinh, can nguoi kiem tra tai nha cung cap.",
                    },
                },
            ],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: {
                        kind: "message.text",
                        intent: "report",
                        title: "Nhac gia han sang nay",
                        text:
                            "Da nhac: EXAMPLE-TM qua thu (ban nhap cho nguoi gui).\n" +
                            "Giu lai: DEMO-SSL - ngay het han la uoc tinh, can nguoi kiem tra tai nha cung cap.",
                    },
                    answer: posted("m-team-1"),
                },
            ],
            output: {
                posted: true,
                reminded: ["EXAMPLE-TM"],
                notRecorded: [],
                notReminded: [],
                held: ["DEMO-SSL"],
                refusal: null,
            },
        },
        {
            name: "posts nothing on a morning with nothing reminded and nothing held, and calls no AI",
            params: {},
            input: { reminded: { items: [], held: null }, held: [], locale: "vi" },
            output: { posted: false, reminded: [], notRecorded: [], notReminded: [], held: [], refusal: null },
        },
        {
            name: "names a service the round could not remind so a person looks",
            params: {},
            input: { reminded: { items: [{ key: "EXAMPLE-TM", output: null }], held: null }, held: [], locale: "vi" },
            agent: [
                { answer: { title: "Nhac gia han sang nay", text: "Chua nhac duoc: EXAMPLE-TM - can nguoi xem lai." } },
            ],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: {
                        kind: "message.text",
                        intent: "report",
                        title: "Nhac gia han sang nay",
                        text: "Chua nhac duoc: EXAMPLE-TM - can nguoi xem lai.",
                    },
                    answer: refused("other_room"),
                },
            ],
            output: {
                posted: false,
                reminded: [],
                notRecorded: [],
                notReminded: ["EXAMPLE-TM"],
                held: [],
                refusal: "other_room",
            },
        },
        {
            name: "names a reminder a person declined to record: reminded, not recorded, so a person records it",
            params: {},
            input: {
                reminded: {
                    items: [
                        {
                            key: "EXAMPLE-TM",
                            output: { serviceCode: "EXAMPLE-TM", channel: ZALO, declined: true, reminderId: null },
                        },
                    ],
                    held: null,
                },
                held: [],
                locale: "vi",
            },
            agent: [
                {
                    answer: {
                        title: "Nhac gia han sang nay",
                        text: "Da nhac nhung chua ghi vao CRM (nguoi duyet tu choi ghi): EXAMPLE-TM.",
                    },
                },
            ],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: {
                        kind: "message.text",
                        intent: "report",
                        title: "Nhac gia han sang nay",
                        text: "Da nhac nhung chua ghi vao CRM (nguoi duyet tu choi ghi): EXAMPLE-TM.",
                    },
                    answer: posted("m-team-1"),
                },
            ],
            output: {
                posted: true,
                reminded: [],
                notRecorded: ["EXAMPLE-TM"],
                notReminded: [],
                held: [],
                refusal: null,
            },
        },
    ],
})
