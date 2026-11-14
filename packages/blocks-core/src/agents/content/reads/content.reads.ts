import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { EntityApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { CONTENT_BRAND_KEY } from "../entities/brand.entity"
import { addDays, weekStartOf } from "../rules/day"
import { CONTENT_STATUSES } from "../rules/post"
import { brandFormOf, brandOfRow, postViewOf, type BrandForm, type PostView } from "../rules/workbench"
import { weekSummaryOf, type WeekSummary } from "../rules/week"
import { zoneDayOf } from "../../../shared/rules/zone-time"
import { CONTENT_VIEW, POSTS_PAGE, WEEK_POSTS_MAX } from "../constants"
import { BRAND, POSTS } from "../ports"

/** The longest cursor a page of posts carries. */
const CURSOR_MAX = 2048

/** The filter of the posts list: every post, or one state. */
const POST_FILTERS = ["all", ...CONTENT_STATUSES] as const

/** The fields of a post a record of the type holds. */
const POST_SELECT: ReadonlyArray<string> = [
    "title",
    "channel",
    "status",
    "day",
    "time",
    "pillar",
    "brief",
    "text",
    "note",
    "media",
    "publishedAt",
    "publishResult",
]

/** The fields of a post the list and the detail show. */
const POST_FIELDS: ReadonlyArray<keyof PostView> = [
    "id",
    "title",
    "channel",
    "status",
    "day",
    "time",
    "pillar",
    "brief",
    "text",
    "note",
    "hasMedia",
    "publishedAt",
    "url",
    "isDraft",
    "isApproved",
]

/** The fields of the brand the form shows. */
const BRAND_FIELDS: ReadonlyArray<keyof BrandForm> = [
    "id",
    "voice",
    "avoid",
    "audience",
    "cta",
    "hashtags",
    "pillars",
    "facebookPosts",
    "facebookDays",
    "facebookTime",
    "zaloPosts",
    "zaloDays",
    "zaloTime",
    "tiktokPosts",
    "tiktokDays",
    "tiktokTime",
    "instagramPosts",
    "instagramDays",
    "instagramTime",
]

/** The brand record of the workspace, or null before the first save. */
export const brandRowOf = async (brand: EntityApi): Promise<RecordRow | null> => {
    const page = await brand.list({
        select: ["voice", "avoid", "audience", "cta", "hashtags", "pillars", "cadence"],
        where: q.eq("key", CONTENT_BRAND_KEY),
        order: [
            ["key", "asc"],
            ["id", "asc"],
        ],
        page: { size: 1 },
    })
    return page.rows[0]?.row ?? null
}

/** `blocks-core.content.api.post.list`: the posts of the workspace by planned day, newest first, narrowed by state. */
export const postsRead: ReadDefinition = defineRead({
    id: "blocks-core.content.api.post.list",
    dataKind: "content-post",
    shape: "list",
    fields: POST_FIELDS,
    paths: { rows: "list" },
    variables: z.object({
        status: z.enum(POST_FILTERS).default("all"),
        cursor: z.string().min(1).max(CURSOR_MAX).optional(),
    }),
    permission: CONTENT_VIEW,
    ports: { posts: POSTS },
    run: async ({ posts }, variables): Promise<{ readonly rows: ReadonlyArray<PostView>; readonly cursor: string | null }> => {
        const page = await posts.list({
            select: POST_SELECT,
            ...(variables.status === "all" ? {} : { where: q.eq("status", variables.status) }),
            order:
                variables.status === "all"
                    ? [
                          ["day", "desc"],
                          ["id", "desc"],
                      ]
                    : [
                          ["status", "asc"],
                          ["day", "desc"],
                          ["id", "desc"],
                      ],
            page: { size: POSTS_PAGE, ...(variables.cursor === undefined ? {} : { after: variables.cursor }) },
        })
        return { rows: page.rows.map((listed) => postViewOf(listed.row)), cursor: page.next }
    },
})

/** `blocks-core.content.api.post.get`: one post, which the detail and the edit form start from; null when there is none. */
export const postRead: ReadDefinition = defineRead({
    id: "blocks-core.content.api.post.get",
    dataKind: "content-post",
    shape: "record",
    fields: POST_FIELDS,
    paths: {},
    variables: z.object({ id: z.string().min(1).max(MAX_ID) }),
    permission: CONTENT_VIEW,
    ports: { posts: POSTS },
    run: async ({ posts }, { id }): Promise<PostView | null> => {
        const found = await posts.get(id)
        return found === null ? null : postViewOf(found)
    },
})

/** `blocks-core.content.api.brand.get`: the brand of the workspace as its form edits it; the starter themes and rhythm before the first save. */
export const brandRead: ReadDefinition = defineRead({
    id: "blocks-core.content.api.brand.get",
    dataKind: "content-brand",
    shape: "record",
    fields: BRAND_FIELDS,
    paths: {},
    variables: z.object({}),
    permission: CONTENT_VIEW,
    ports: { brand: BRAND },
    run: async ({ brand }): Promise<BrandForm> => {
        const row = await brandRowOf(brand)
        return brandFormOf(row?.id ?? "", brandOfRow(row))
    },
})

/** `blocks-core.content.api.post.week`: how the posts planned for this week (Monday to Sunday on the shop's calendar) stand. */
export const weekRead: ReadDefinition = defineRead({
    id: "blocks-core.content.api.post.week",
    dataKind: "content-post",
    shape: "record",
    fields: ["from", "to", "planned", "drafts", "approved", "published"],
    paths: {},
    variables: z.object({}),
    permission: CONTENT_VIEW,
    ports: { posts: POSTS },
    run: async ({ posts }, _variables, context): Promise<WeekSummary> => {
        const from = weekStartOf(zoneDayOf(context.now.getTime(), context.timeZone))
        const to = addDays(from, 6)
        const page = await posts.list({
            select: ["status", "channel", "day"],
            where: q.and(q.gte("day", from), q.lte("day", to)),
            order: [
                ["day", "asc"],
                ["id", "asc"],
            ],
            page: { size: WEEK_POSTS_MAX },
        })
        return weekSummaryOf(
            { from, to },
            page.rows.map((listed) => {
                const view = postViewOf(listed.row)
                return { status: view.status, channel: view.channel, day: view.day }
            }),
        )
    },
})
