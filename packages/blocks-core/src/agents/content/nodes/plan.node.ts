import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import { planGoalOf } from "../rules/channels"
import { addDays } from "../rules/day"
import { planMonth, slotLineOf } from "../rules/plan"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, valueOrCannot } from "../../../shared/nodes/tool-answers"
import { BRAND_LIST_ARGS, POST_TYPE, brandOf, postsOfList, recordAnswerOf, recordIdOf } from "./content.reads"

type NoParams = Record<string, never>

/** The most posts one plan writes: the most items the drafting workflow's loop takes. */
export const PLAN_POSTS_MAX = 50

/** What the plan reads beside the brand: the owner's words when a person asked for it in the chat. */
export interface PlanInput {
    /** The words of the post, hashtags included. */
    readonly text: string | null
}

/** The input as a graph binds it: a clock tick carries no words. */
export interface PlanInputGiven {
    /** The words of the post, hashtags included. */
    readonly text?: string | null | undefined
}

/** The posts the plan wrote, by id, in order. */
export interface PlanOutput {
    /** The posts written, in plan order. */
    readonly postIds: ReadonlyArray<string>
    /** The posts planned for the week. */
    readonly planned: number
    /** True when a person declined a draft post on its card: the posts written before it stay, the rest were not planned. */
    readonly declined: boolean
}

/** One idea the agent writes for a slot. */
type PlanIdea = { readonly slot: number; readonly title: string; readonly brief: string }

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<PlanInput, PlanInputGiven> = z.object({
    text: z.string().max(MAX_BODY).nullable().default(null),
})
const output: NodeSchema<PlanOutput> = z.object({
    postIds: z.array(z.string().min(1).max(MAX_ID)).max(PLAN_POSTS_MAX).describe("The posts written, in plan order."),
    planned: z.number().int().min(0).describe("How many posts the plan wrote."),
    declined: z.boolean().describe("True when a person declined a draft post on its card: the posts written before it stay, the rest were not planned."),
})

/** What the agent answers: one idea per slot. */
const ideasSchema = z.object({
    ideas: z
        .array(
            z.object({
                slot: z.number().int().min(1).describe("The slot number, as given"),
                title: z.string().min(1).max(MAX_LINE).describe("The post title, in Vietnamese"),
                brief: z.string().max(MAX_BODY).describe("A concrete angle for the writer, grounded in what you found"),
            }),
        )
        .max(PLAN_POSTS_MAX),
})

/** The read of the posts already planned from a day on, so a second plan of the same month writes none twice. */
const plannedFrom = (day: string): JsonObject => ({
    type: POST_TYPE,
    where: { op: "gte", field: "day", value: day },
    order: [["day", "asc"]],
    limit: PLAN_POSTS_MAX,
})

/**
 * `content.plan`: plans the rest of the month from tomorrow, on the shop's calendar. Code settles each moment
 * from the brand's rhythm, its channels, its theme from the brand's weighted themes and the calendar occasion pinned to it
 * (`rules/content/plan`); the agent writes one idea per moment, searching the Second Brain for the products, services, real offers and
 * the brand guideline. One draft post per channel of a moment is created (`blocks-core.content.post`); a moment and channel the month already holds
 * is skipped, so a second plan writes nothing twice. A brand with no rhythm plans nothing.
 */
export const contentPlanNode: TemplateNode<
    NodeSchema<PlanInput, PlanInputGiven>,
    NodeSchema<PlanOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "content.plan",
    title: bilingualOf("nodeContentPlanTitle"),
    description: { vi: "L\u00ean k\u1ebf ho\u1ea1ch b\u00e0i \u0111\u0103ng cho ph\u1ea7n c\u00f2n l\u1ea1i c\u1ee7a th\u00e1ng theo nh\u1ecbp \u0111\u0103ng v\u00e0 ch\u1ee7 \u0111\u1ec1 c\u1ee7a th\u01b0\u01a1ng hi\u1ec7u, m\u1ed7i b\u00e0i m\u1ed9t \u00fd t\u01b0\u1edfng, t\u1ea1o s\u1eb5n b\u1ea3n nh\u00e1p cho t\u1eebng k\u00eanh.", en: "Plans the posts for the rest of the month on the brand's rhythm and themes, one idea each, and creates a draft for each channel." },
    tools: [],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const brand = await brandOf(context)
        const fromDay = addDays(context.run.day, 1)
        const plan = planMonth(fromDay, brand.cadence, brand.pillars)
        if (plan.slots.length === 0) return { postIds: [], planned: 0, declined: false }
        const held = postsOfList(
            valueOrCannot(context, TOOL.recordList, await context.tools.call(TOOL.recordList, plannedFrom(fromDay))),
        )
        const taken = new Set(held.map((post) => `${post.day ?? ""} ${post.time} ${post.channel}`))
        const open = plan.slots
            .map((slot) => ({
                slot,
                channels: slot.channels.filter((channel) => !taken.has(`${slot.day} ${slot.time} ${channel}`)),
            }))
            .filter((entry) => entry.channels.length > 0)
        if (open.length === 0) return { postIds: [], planned: 0, declined: false }
        const answer = await context.agent.run({
            goal: planGoalOf(brand),
            input: {
                month: fromDay.slice(0, 7),
                slots: open.map((entry) => slotLineOf({ ...entry.slot, channels: entry.channels })),
                request: given.text,
                existing: held.map((post) => post.title),
            },
            output: ideasSchema,
            maxTurns: 6,
        })
        const ideas = new Map<number, PlanIdea>(answer.ideas.map((idea) => [idea.slot, idea]))
        const writes = open.flatMap((entry) => {
            const idea = ideas.get(entry.slot.n)
            return idea === undefined
                ? []
                : entry.channels.map((channel) => ({
                      type: POST_TYPE,
                      values: {
                          channel,
                          status: "draft",
                          title: idea.title,
                          brief: idea.brief,
                          pillar: entry.slot.pillar.name,
                          day: entry.slot.day,
                          time: entry.slot.time,
                      },
                  }))
        })
        const written: Array<string> = []
        for (const write of writes.slice(0, PLAN_POSTS_MAX)) {
            const created = await context.tools.call(TOOL.recordCreate, write)
            if (!created.ok && created.declined === true) return { postIds: written, planned: written.length, declined: true }
            written.push(recordIdOf(valueOrCannot(context, TOOL.recordCreate, created)))
        }
        return { postIds: written, planned: written.length, declined: false }
    },
    examples: [
        {
            name: "plans the rest of the month on the brand's rhythm: one idea per moment, one draft per channel",
            at: "2026-11-24T02:00:00.000Z",
            day: "2026-11-24",
            params: {},
            input: {},
            tools: [
                {
                    id: TOOL.recordList,
                    args: BRAND_LIST_ARGS,
                    answer: answered({
                        records: [
                            recordAnswerOf("brand-1", {
                                voice: "Friendly",
                                avoid: "",
                                audience: "",
                                cta: "",
                                hashtags: "",
                                pillars: {
                                    items: [{ name: "Fresh flowers", description: "", weight: 1, active: true }],
                                },
                                cadence: {
                                    items: [{ channel: "facebook", postsPerWeek: 1, days: [4], time: "19:30" }],
                                },
                            }),
                        ],
                        next: null,
                    }),
                },
                { id: TOOL.recordList, args: plannedFrom("2026-11-25"), answer: answered({ records: [], next: null }) },
                {
                    id: TOOL.recordCreate,
                    args: {
                        type: POST_TYPE,
                        values: {
                            channel: "facebook",
                            status: "draft",
                            title: "Flowers to thank a teacher",
                            brief: "A small bouquet",
                            pillar: "Fresh flowers",
                            day: "2026-11-26",
                            time: "19:30",
                        },
                    },
                    answer: answered({ record: recordAnswerOf("post-1", {}) }),
                },
            ],
            agent: [
                { answer: { ideas: [{ slot: 1, title: "Flowers to thank a teacher", brief: "A small bouquet" }] } },
            ],
            output: { postIds: ["post-1"], planned: 1, declined: false },
        },
        {
            name: "a person declined the first draft post: nothing is planned",
            at: "2026-11-24T02:00:00.000Z",
            day: "2026-11-24",
            params: {},
            input: {},
            tools: [
                {
                    id: TOOL.recordList,
                    args: BRAND_LIST_ARGS,
                    answer: answered({
                        records: [
                            recordAnswerOf("brand-1", {
                                voice: "Friendly",
                                avoid: "",
                                audience: "",
                                cta: "",
                                hashtags: "",
                                pillars: {
                                    items: [{ name: "Fresh flowers", description: "", weight: 1, active: true }],
                                },
                                cadence: {
                                    items: [{ channel: "facebook", postsPerWeek: 1, days: [4], time: "19:30" }],
                                },
                            }),
                        ],
                        next: null,
                    }),
                },
                { id: TOOL.recordList, args: plannedFrom("2026-11-25"), answer: answered({ records: [], next: null }) },
                {
                    id: TOOL.recordCreate,
                    args: {
                        type: POST_TYPE,
                        values: {
                            channel: "facebook",
                            status: "draft",
                            title: "Flowers to thank a teacher",
                            brief: "A small bouquet",
                            pillar: "Fresh flowers",
                            day: "2026-11-26",
                            time: "19:30",
                        },
                    },
                    answer: refused("declined"),
                },
            ],
            agent: [
                { answer: { ideas: [{ slot: 1, title: "Flowers to thank a teacher", brief: "A small bouquet" }] } },
            ],
            output: { postIds: [], planned: 0, declined: true },
        },
        {
            name: "a brand with no rhythm plans nothing and asks no model",
            at: "2026-11-24T02:00:00.000Z",
            day: "2026-11-24",
            params: {},
            input: { text: null },
            tools: [
                {
                    id: TOOL.recordList,
                    args: BRAND_LIST_ARGS,
                    answer: answered({
                        records: [recordAnswerOf("brand-1", { cadence: { items: [] } })],
                        next: null,
                    }),
                },
            ],
            output: { postIds: [], planned: 0, declined: false },
        },
        {
            name: "a month already planned writes nothing twice",
            at: "2026-11-24T02:00:00.000Z",
            day: "2026-11-24",
            params: {},
            input: {},
            tools: [
                {
                    id: TOOL.recordList,
                    args: BRAND_LIST_ARGS,
                    answer: answered({
                        records: [
                            recordAnswerOf("brand-1", {
                                cadence: { items: [{ channel: "zalo", postsPerWeek: 1, days: [4], time: "10:00" }] },
                            }),
                        ],
                        next: null,
                    }),
                },
                {
                    id: TOOL.recordList,
                    args: plannedFrom("2026-11-25"),
                    answer: answered({
                        records: [
                            recordAnswerOf("post-9", {
                                channel: "zalo",
                                status: "draft",
                                title: "Already planned",
                                day: "2026-11-26",
                                time: "10:00",
                            }),
                        ],
                        next: null,
                    }),
                },
            ],
            output: { postIds: [], planned: 0, declined: false },
        },
    ],
})
