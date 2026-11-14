import { defineAction, type ActionDefinition, type ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EngineResult } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { BRAND_TEXT_MAX, CONTENT_BRAND_KEY } from "../entities/brand.entity"
import { POSTS_PER_WEEK_MAX } from "../rules/brand"
import { isDay } from "../rules/day"
import { CONTENT_CHANNELS, wallTimeOf } from "../rules/post"
import { brandOfForm, postEditShape, type BrandFormProblem } from "../rules/workbench"
import { CONTENT_MANAGE } from "../constants"
import { BRAND, POSTS } from "../ports"

/** The reads a post write refreshes. */
const POST_READS = ["blocks-core.content.api.post.list", "blocks-core.content.api.post.get", "blocks-core.content.api.post.week"] as const

/** The id the host sends with every action; an action on no record gets an empty one. */
const hostRecordId = z.string().max(MAX_ID).optional()

/** Why a Content action refused, each with a message of the module under `refusal_<reason>`. */
type ContentRefusal = "post_missing" | "not_draft" | "not_approved" | "day_invalid" | "time_invalid"

const refusedWith = (reason: ContentRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: { key: `refusal_${reason}` },
})

/** The answer to a write another writer got to first: the person reloads and tries again. */
const CONFLICT: ActionResult = { ok: false, reason: "conflict", message: { key: "refusal_conflict" } }

/** The answer of a write: the record's id, or why it was not written. */
const writtenOf = (written: EngineResult): ActionResult => {
    if (written.ok) return { ok: true, data: { id: written.row.id } }
    return written.reason === "missing" ? refusedWith("post_missing") : CONFLICT
}

/** The words of a brand form's problem, by its issue. */
const PROBLEM_KEYS: Readonly<Record<BrandFormProblem["issue"], string>> = {
    pillar_invalid: "refusal_pillar_invalid",
    days_invalid: "refusal_days_invalid",
    time_invalid: "refusal_time_invalid",
}

const posts = z.number().min(0).max(POSTS_PER_WEEK_MAX)
const short = z.string().max(MAX_LINE)

const saveBrandInput = z.object({
    id: hostRecordId,
    voice: z.string().max(BRAND_TEXT_MAX),
    avoid: z.string().max(BRAND_TEXT_MAX),
    audience: z.string().max(BRAND_TEXT_MAX),
    cta: short,
    hashtags: short,
    pillars: z.string().max(BRAND_TEXT_MAX * 4),
    facebookPosts: posts,
    facebookDays: short,
    facebookTime: short,
    zaloPosts: posts,
    zaloDays: short,
    zaloTime: short,
    tiktokPosts: posts,
    tiktokDays: short,
    tiktokTime: short,
    instagramPosts: posts,
    instagramDays: short,
    instagramTime: short,
})

/**
 * `blocks-core.content.brand-save`: saves the brand of the workspace (the one record): the voice, what posts never say, the audience, the call to
 * action, the hashtags, the themes (one per line, `name | description | weight`) and each channel's rhythm (posts a week, weekdays
 * Monday 1 to Sunday 7, the time). A theme, a weekday or a time that is none is refused with the words on its own field.
 */
export const saveBrandAction: ActionDefinition = defineAction({
    id: "blocks-core.content.brand-save",
    permission: CONTENT_MANAGE,
    label: { key: "action_save_brand" },
    input: saveBrandInput,
    ports: { brand: BRAND },
    transactional: true,
    run: async ({ brand }, input) => {
        const parsed = brandOfForm(input)
        if (!parsed.ok) {
            const [first] = parsed.problems
            return {
                ok: false,
                reason: "invalid",
                message: { key: first === undefined ? "refusal_conflict" : PROBLEM_KEYS[first.issue] },
                fields: Object.fromEntries(parsed.problems.map((problem) => [problem.field, { key: PROBLEM_KEYS[problem.issue] }])),
            }
        }
        const written = await brand.upsert("brand_key", {
            key: CONTENT_BRAND_KEY,
            voice: parsed.brand.voice,
            avoid: parsed.brand.avoid,
            audience: parsed.brand.audience,
            cta: parsed.brand.cta,
            hashtags: parsed.brand.hashtags,
            pillars: { items: parsed.brand.pillars },
            cadence: { items: parsed.brand.cadence },
        })
        return written.ok ? { ok: true, data: { id: written.row.id } } : CONFLICT
    },
    refreshes: ["blocks-core.content.api.brand.get"],
    optimistic: false,
})

const savePostInput = postEditShape.extend({
    id: hostRecordId,
    channel: z.enum(CONTENT_CHANNELS).optional(),
    day: z.string().max(10).optional(),
    time: z.string().max(5).optional(),
})

/**
 * `blocks-core.content.post-save`: writes a new post by hand (its channel, title, brief, words, day and time), or changes the title, brief and words
 * of the one the id names. A new post is a draft; the agent's approval step or a person approves it.
 */
export const savePostAction: ActionDefinition = defineAction({
    id: "blocks-core.content.post-save",
    permission: CONTENT_MANAGE,
    label: { key: "action_save_post" },
    input: savePostInput,
    ports: { posts: POSTS },
    transactional: true,
    run: async ({ posts }, input) => {
        const day = input.day === undefined || input.day === "" ? null : input.day
        if (day !== null && !isDay(day)) return refusedWith("day_invalid")
        const time = input.time === undefined || input.time === "" ? "" : wallTimeOf(input.time)
        if (time === null) return refusedWith("time_invalid")
        const words = { title: input.title, brief: input.brief.trim(), text: input.text.trim() }
        if (input.id === undefined || input.id === "")
            return writtenOf(await posts.insert({ ...words, channel: input.channel ?? "facebook", status: "draft", day, time }))
        const current = await posts.get(input.id)
        if (current === null) return refusedWith("post_missing")
        return writtenOf(await posts.update(current.id, current.version, words))
    },
    refreshes: POST_READS,
    optimistic: false,
})

/** `blocks-core.content.post-approve`: a person approves a draft from the workbench; the post then waits to be published. */
export const approvePostAction: ActionDefinition = defineAction({
    id: "blocks-core.content.post-approve",
    permission: CONTENT_MANAGE,
    label: { key: "action_approve_post" },
    input: z.object({ id: z.string().min(1).max(MAX_ID) }),
    ports: { posts: POSTS },
    transactional: true,
    run: async ({ posts }, { id }) => {
        const current = await posts.get(id)
        if (current === null) return refusedWith("post_missing")
        if (current.data["status"] !== "draft") return refusedWith("not_draft")
        return writtenOf(await posts.update(current.id, current.version, { status: "approved" }))
    },
    refreshes: POST_READS,
    optimistic: false,
})

const markPublishedInput = z.object({
    id: z.string().min(1).max(MAX_ID),
    url: z.string().trim().max(MAX_LINE).optional(),
})

/**
 * `blocks-core.content.post-publish`: records that an approved post was published on its channel (by hand, until a tool publishes it), with its
 * public address when the person gives one.
 */
export const markPublishedAction: ActionDefinition = defineAction({
    id: "blocks-core.content.post-publish",
    permission: CONTENT_MANAGE,
    label: { key: "action_mark_published" },
    input: markPublishedInput,
    ports: { posts: POSTS },
    transactional: true,
    run: async ({ posts }, input, context) => {
        const current = await posts.get(input.id)
        if (current === null) return refusedWith("post_missing")
        if (current.data["status"] !== "approved") return refusedWith("not_approved")
        const url = input.url === undefined || input.url === "" ? null : input.url
        return writtenOf(
            await posts.update(current.id, current.version, {
                status: "published",
                publishedAt: context.now.toISOString(),
                publishResult: { postId: null, url },
            }),
        )
    },
    refreshes: POST_READS,
    optimistic: false,
})
