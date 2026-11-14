import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { BRAND_TEXT_MAX } from "../../entities/content/brand.entity"
import { STARTER_BRAND, brandCadenceShape, brandPillarsShape, type ContentBrand } from "../../rules/content/brand"
import {
    CONTENT_CHANNELS,
    CONTENT_STATUSES,
    POST_TEXT_MAX,
    type ContentChannel,
    type ContentStatus,
} from "../../rules/content/post"
import { valueOrCannot } from "../tool-answers"

/** The record type of the content brand. */
export const BRAND_TYPE = "blocks-core.content.brand"

/** The record type of a post. */
export const POST_TYPE = "blocks-core.content.post"

/** The most declared values one record answer carries. */
const VALUES_MAX = 50

/** The most records one list answer carries: the record tools' page cap. */
const LIST_MAX = 50

/** The length of a calendar day, `YYYY-MM-DD`. */
const DAY_LENGTH = 10

/** The length of a wall-clock time, `HH:MM`. */
const TIME_LENGTH = 5

/** A post as the content nodes read it. */
export type PostFacts = {
    /** The record's id. */
    readonly id: string
    /** The social channel. */
    readonly channel: ContentChannel
    /** Where the post stands. */
    readonly status: ContentStatus
    /** The title of the post. */
    readonly title: string
    /** The idea the post is written from. */
    readonly brief: string
    /** The theme the post is written on. */
    readonly pillar: string
    /** The words of the post, hashtags included. */
    readonly text: string
    /** The calendar day, `YYYY-MM-DD`; null when none. */
    readonly day: string | null
    /** The wall-clock time on the shop's clock, `HH:MM`; empty when none. */
    readonly time: string
}

/** One record as the record tools answer it: its id, version and declared values. */
const recordShape = z.looseObject({
    id: z.string().min(1).max(MAX_ID),
    version: z.string().max(MAX_ID),
    values: z.record(z.string().max(MAX_ID), z.json()).refine((values) => Object.keys(values).length <= VALUES_MAX),
})

const listAnswer = z.looseObject({ records: z.array(recordShape).max(LIST_MAX) })
const oneAnswer = z.looseObject({ record: recordShape })

const brandValues = z.object({
    voice: z.string().max(BRAND_TEXT_MAX).catch(""),
    avoid: z.string().max(BRAND_TEXT_MAX).catch(""),
    audience: z.string().max(BRAND_TEXT_MAX).catch(""),
    cta: z.string().max(MAX_LINE).catch(""),
    hashtags: z.string().max(MAX_LINE).catch(""),
    pillars: brandPillarsShape.catch({ items: STARTER_BRAND.pillars }),
    cadence: brandCadenceShape.catch({ items: STARTER_BRAND.cadence }),
})

const postValues = z.object({
    channel: z.enum(CONTENT_CHANNELS),
    status: z.enum(CONTENT_STATUSES),
    title: z.string().max(MAX_LINE),
    brief: z.string().max(POST_TEXT_MAX).catch(""),
    pillar: z.string().max(MAX_LINE).catch(""),
    text: z.string().max(POST_TEXT_MAX).catch(""),
    day: z.string().max(DAY_LENGTH).nullable().catch(null),
    time: z.string().max(TIME_LENGTH).catch(""),
})

/** The brand the workspace saved, from a record list's value; the starter brand when it saved none. */
export const brandOfList = (value: unknown): ContentBrand => {
    const [first] = listAnswer.parse(value).records
    if (first === undefined) return STARTER_BRAND
    const values = brandValues.parse(first.values)
    return { ...values, pillars: values.pillars.items, cadence: values.cadence.items }
}

/** A post from one record. */
const postOfRecord = (record: z.output<typeof recordShape>): PostFacts => ({
    id: record.id,
    ...postValues.parse(record.values),
})

/** The posts of a record list's value. */
export const postsOfList = (value: unknown): ReadonlyArray<PostFacts> =>
    listAnswer.parse(value).records.map((record) => postOfRecord(record))

/** The post of a record get's value. */
export const postOfGet = (value: unknown): PostFacts => postOfRecord(oneAnswer.parse(value).record)

/** The id of the record a create or update answered. */
export const recordIdOf = (value: unknown): string => oneAnswer.parse(value).record.id

/** The one call that reads the brand of the workspace. */
export const BRAND_LIST_ARGS: JsonObject = { type: BRAND_TYPE, limit: 1 }

/** Reads the brand of the workspace; the starter brand when it saved none. */
export const brandOf = async (context: Pick<NodeContext, "tools" | "fail">): Promise<ContentBrand> =>
    brandOfList(valueOrCannot(context, TOOL.recordList, await context.tools.call(TOOL.recordList, BRAND_LIST_ARGS)))

/** A record as an example's answer holds it. */
export const recordAnswerOf = (id: string, values: JsonObject): JsonObject => ({
    id,
    version: "1",
    createdAt: "2026-11-13T01:00:00.000Z",
    updatedAt: "2026-11-13T01:00:00.000Z",
    values,
})
