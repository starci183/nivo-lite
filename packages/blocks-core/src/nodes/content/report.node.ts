import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { bilingualOf, messageOf } from "../../messages/catalog"
import { isoWeekdayOf } from "../../rules/content/day"
import { fillTemplate, lastWeekOf, weekSummaryOf, type Week, type WeekSummary } from "../../rules/content/week"
import type { NodeSchema } from "../node-schema.types"
import { answered, valueOrCannot } from "../tool-answers"
import { POST_TYPE, postsOfList, recordAnswerOf } from "./content.reads"

type NoParams = Record<string, never>

/** The ISO weekday the report is posted on. */
const MONDAY = 1

/** The most posts of one week the report reads. */
const WEEK_POSTS_MAX = 50

/** What the report said. */
export interface ReportOutput {
    /** The first day, `YYYY-MM-DD`. */
    readonly from: string
    /** The last day, `YYYY-MM-DD`. */
    readonly to: string
    /** The posts planned for the week. */
    readonly planned: number
    /** The posts of the week published. */
    readonly published: number
    /** Whether the team was told. */
    readonly posted: boolean
}

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<Record<string, never>> = z.object({})
const output: NodeSchema<ReportOutput> = z.object({
    from: z.string().length(10).describe("The Monday of the week reported, YYYY-MM-DD."),
    to: z.string().length(10).describe("Its Sunday."),
    planned: z.number().int().min(0).describe("The posts planned for the week."),
    published: z.number().int().min(0).describe("The posts of the week published."),
    posted: z.boolean().describe("True when the report was posted: on the shop's Monday only."),
})

/** The read of the posts planned for a week. */
const weekPosts = (week: Week): JsonObject => ({
    type: POST_TYPE,
    where: {
        op: "and",
        of: [
            { op: "gte", field: "day", value: week.from },
            { op: "lte", field: "day", value: week.to },
        ],
    },
    order: [["day", "asc"]],
    limit: WEEK_POSTS_MAX,
})

/** The report line to the team. */
const reportOf = (summary: WeekSummary): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    title: messageOf("vi", "nodeContentReportHeading"),
    text: fillTemplate(messageOf("vi", "nodeContentReportLine"), {
        from: summary.from,
        to: summary.to,
        planned: summary.planned,
        published: summary.published,
        approved: summary.approved,
        drafts: summary.drafts,
    }),
})

const WEEK: Week = { from: "2026-11-09", to: "2026-11-15" }

/**
 * `content.report`: on the shop's Monday (the daily clock; no weekly clock preset exists), tells the team how the last whole week's posts stand: how many were planned,
 * published, approved and still drafts (`rules/content/week`). The channels' reach and engagement need a provider tool no channel has
 * yet (SHAPE-NOTES `3-A-content`). No AI call.
 */
export const contentReportNode: TemplateNode<
    NodeSchema<Record<string, never>>,
    NodeSchema<ReportOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "content.report",
    title: bilingualOf("nodeContentReportTitle"),
    description: { vi: "V\u00e0o th\u1ee9 Hai, b\u00e1o cho \u0111\u1ed9i tu\u1ea7n tr\u01b0\u1edbc c\u00f3 bao nhi\u00eau b\u00e0i \u0111\u00e3 l\u00ean k\u1ebf ho\u1ea1ch, \u0111\u00e3 \u0111\u0103ng, \u0111\u00e3 duy\u1ec7t v\u00e0 c\u00f2n l\u00e0 b\u1ea3n nh\u00e1p.", en: "On Monday, tells the team how last week's posts stand: planned, published, approved and still drafts." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    run: async (_given, context) => {
        const week = lastWeekOf(context.run.day)
        if (isoWeekdayOf(context.run.day) !== MONDAY)
            return { from: week.from, to: week.to, planned: 0, published: 0, posted: false }
        const posts = postsOfList(
            valueOrCannot(context, TOOL.recordList, await context.tools.call(TOOL.recordList, weekPosts(week))),
        )
        const summary = weekSummaryOf(week, posts)
        const sent = await context.tools.call(TOOL.teamMessagePost, reportOf(summary))
        if (!sent.ok && sent.declined === true)
            return { from: summary.from, to: summary.to, planned: summary.planned, published: summary.published, posted: false }
        valueOrCannot(context, TOOL.teamMessagePost, sent)
        return {
            from: summary.from,
            to: summary.to,
            planned: summary.planned,
            published: summary.published,
            posted: true,
        }
    },
    examples: [
        {
            name: "on Monday, tells the team how the last week's posts stand",
            at: "2026-11-16T01:00:00.000Z",
            day: "2026-11-16",
            params: {},
            input: {},
            tools: [
                {
                    id: TOOL.recordList,
                    args: weekPosts(WEEK),
                    answer: answered({
                        records: [
                            recordAnswerOf("post-1", {
                                channel: "zalo",
                                status: "published",
                                title: "A",
                                day: "2026-11-10",
                            }),
                            recordAnswerOf("post-2", {
                                channel: "facebook",
                                status: "draft",
                                title: "B",
                                day: "2026-11-12",
                            }),
                        ],
                        next: null,
                    }),
                },
                {
                    id: TOOL.teamMessagePost,
                    args: reportOf({
                        ...WEEK,
                        planned: 2,
                        drafts: 1,
                        approved: 0,
                        published: 1,
                        byChannel: { facebook: 1, zalo: 1, tiktok: 0, instagram: 0 },
                    }),
                    answer: answered({ messageId: "m-report" }),
                },
            ],
            output: { from: "2026-11-09", to: "2026-11-15", planned: 2, published: 1, posted: true },
        },
        {
            name: "on another day of the week the daily clock posts nothing",
            at: "2026-11-18T01:00:00.000Z",
            day: "2026-11-18",
            params: {},
            input: {},
            tools: [],
            output: { from: "2026-11-09", to: "2026-11-15", planned: 0, published: 0, posted: false },
        },
    ],
})
