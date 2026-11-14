import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_LINE } from "../../../shared/bounds"
import { PILLAR_WEIGHT_MAX, PILLARS_MAX, POSTS_PER_WEEK_MAX, STARTER_BRAND, brandCadenceShape, brandPillarsShape, type BrandChannelCadence, type BrandPillar, type ContentBrand } from "./brand"
import { CONTENT_CHANNELS, CONTENT_STATUSES, POST_TEXT_MAX, publishResultShape, wallTimeOf, type ContentChannel, type ContentStatus } from "./post"

/** A post as the workbench's list and detail show it. */
export type PostView = {
    /** The record's id. */
    readonly id: string
    /** The title of the post. */
    readonly title: string
    /** The social channel. */
    readonly channel: ContentChannel
    /** Where the post stands. */
    readonly status: ContentStatus
    /** The calendar day, `YYYY-MM-DD`; null when none. */
    readonly day: string | null
    /** The wall-clock time on the shop's clock, `HH:MM`; empty when none. */
    readonly time: string
    /** The theme the post is written on. */
    readonly pillar: string
    /** The idea the post is written from. */
    readonly brief: string
    /** The words of the post, hashtags included. */
    readonly text: string
    /** A note for the owner: a picture or filming suggestion. */
    readonly note: string
    /** Whether a picture or clip is attached. */
    readonly hasMedia: boolean
    /** When it was published; null while it is not. */
    readonly publishedAt: string | null
    /** The public address of the post; null when none. */
    readonly url: string | null
    /** Whether it is a draft (the detail then offers the approval). */
    readonly isDraft: boolean
    /** Whether it is approved (the detail then offers to mark it published). */
    readonly isApproved: boolean
}

/** The days and time of one channel's rhythm as the brand form edits them. */
type ChannelFields = {
    readonly [K in `${ContentChannel}Posts` | `${ContentChannel}Days` | `${ContentChannel}Time`]: K extends `${string}Posts`
        ? number
        : string
}

/** The brand as the brand form edits it: the texts, the themes one per line, each channel's rhythm in three fields. */
export type BrandForm = ChannelFields & {
    /** The record's id. */
    readonly id: string
    /** How the posts sound and address people. */
    readonly voice: string
    /** What the posts never say. */
    readonly avoid: string
    /** Who the posts speak to. */
    readonly audience: string
    /** The call to action the posts end on. */
    readonly cta: string
    /** The brand's own hashtags. */
    readonly hashtags: string
    /** The content themes. */
    readonly pillars: string
}

/** Why a brand form was refused, by field. */
export type BrandFormProblem = {
    /** The form field the problem is on. */
    readonly field: string
    /** What is wrong with it. */
    readonly issue: "pillar_invalid" | "days_invalid" | "time_invalid"
}

/** The text of a record field, or empty. */
const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const statusOf = (value: unknown): ContentStatus =>
    CONTENT_STATUSES.find((status) => status === value) ?? "draft"

const channelOf = (value: unknown): ContentChannel =>
    CONTENT_CHANNELS.find((channel) => channel === value) ?? "facebook"

/** A post record as the workbench shows it. */
export const postViewOf = (row: RecordRow): PostView => {
    const status = statusOf(row.data["status"])
    const result = publishResultShape.safeParse(row.data["publishResult"])
    const day = row.data["day"]
    const publishedAt = row.data["publishedAt"]
    return {
        id: row.id,
        title: textOf(row.data["title"]),
        channel: channelOf(row.data["channel"]),
        status,
        day: typeof day === "string" ? day : null,
        time: textOf(row.data["time"]),
        pillar: textOf(row.data["pillar"]),
        brief: textOf(row.data["brief"]),
        text: textOf(row.data["text"]),
        note: textOf(row.data["note"]),
        hasMedia: typeof row.data["media"] === "object" && row.data["media"] !== null,
        publishedAt: typeof publishedAt === "string" ? publishedAt : null,
        url: result.success ? result.data.url : null,
        isDraft: status === "draft",
        isApproved: status === "approved",
    }
}

/** The brand a record holds; the starter brand for none. */
export const brandOfRow = (row: RecordRow | null): ContentBrand => {
    if (row === null) return STARTER_BRAND
    const pillars = brandPillarsShape.safeParse(row.data["pillars"])
    const cadence = brandCadenceShape.safeParse(row.data["cadence"])
    return {
        voice: textOf(row.data["voice"]),
        avoid: textOf(row.data["avoid"]),
        audience: textOf(row.data["audience"]),
        cta: textOf(row.data["cta"]),
        hashtags: textOf(row.data["hashtags"]),
        pillars: pillars.success ? pillars.data.items : STARTER_BRAND.pillars,
        cadence: cadence.success ? cadence.data.items : STARTER_BRAND.cadence,
    }
}

/** One theme as a line of the form: `name | description | weight`. */
const pillarLineOf = (pillar: BrandPillar): string =>
    [pillar.name, pillar.description, String(pillar.active ? pillar.weight : 0)].join(" | ")

/** The brand as the form starts from it. */
export const brandFormOf = (id: string, brand: ContentBrand): BrandForm => {
    const rhythm = (channel: ContentChannel): BrandChannelCadence | undefined =>
        brand.cadence.find((one) => one.channel === channel)
    const posts = (channel: ContentChannel): number => rhythm(channel)?.postsPerWeek ?? 0
    const days = (channel: ContentChannel): string => (rhythm(channel)?.days ?? []).join(",")
    const time = (channel: ContentChannel): string => rhythm(channel)?.time ?? ""
    return {
        id,
        voice: brand.voice,
        avoid: brand.avoid,
        audience: brand.audience,
        cta: brand.cta,
        hashtags: brand.hashtags,
        pillars: brand.pillars.map((pillar) => pillarLineOf(pillar)).join("\n"),
        facebookPosts: posts("facebook"),
        facebookDays: days("facebook"),
        facebookTime: time("facebook"),
        zaloPosts: posts("zalo"),
        zaloDays: days("zalo"),
        zaloTime: time("zalo"),
        tiktokPosts: posts("tiktok"),
        tiktokDays: days("tiktok"),
        tiktokTime: time("tiktok"),
        instagramPosts: posts("instagram"),
        instagramDays: days("instagram"),
        instagramTime: time("instagram"),
    }
}

/** One line of the themes field as a theme: a name, an optional description and an optional weight (1 when absent, 0 pauses it). */
export const pillarOfLine = (line: string): BrandPillar | null => {
    const [name = "", description = "", weight = ""] = line.split("|").map((part) => part.trim())
    if (name === "" || name.length > MAX_LINE || description.length > MAX_LINE) return null
    const parsed = weight === "" ? 1 : Number(weight)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > PILLAR_WEIGHT_MAX) return null
    return { name, description, weight: parsed, active: parsed > 0 }
}

/** The weekdays a field names (`2,4,6`), or null when one is no weekday. */
export const weekdaysOf = (text: string): ReadonlyArray<number> | null => {
    const parts = text
        .split(/[\s,]+/u)
        .map((part) => part.trim())
        .filter((part) => part !== "")
    const days = parts.map(Number)
    return days.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) ? [...new Set(days)].sort((a, b) => a - b) : null
}

/** What the brand form gives, before it is checked. */
export type BrandFormInput = Omit<BrandForm, "id">

/** The brand a form gives, or the problems of its fields. */
export const brandOfForm = (
    form: BrandFormInput,
): { readonly ok: true; readonly brand: ContentBrand } | { readonly ok: false; readonly problems: ReadonlyArray<BrandFormProblem> } => {
    const problems: Array<BrandFormProblem> = []
    const lines = form.pillars
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
    const pillars = lines.map((line) => pillarOfLine(line))
    if (pillars.includes(null) || pillars.length > PILLARS_MAX)
        problems.push({ field: "pillars", issue: "pillar_invalid" })
    const cadence = CONTENT_CHANNELS.flatMap((channel): ReadonlyArray<BrandChannelCadence> => {
        const postsPerWeek = Math.max(0, Math.min(POSTS_PER_WEEK_MAX, Math.round(form[`${channel}Posts`])))
        if (postsPerWeek === 0) return []
        const days = weekdaysOf(form[`${channel}Days`])
        const time = wallTimeOf(form[`${channel}Time`])
        if (days === null) problems.push({ field: `${channel}Days`, issue: "days_invalid" })
        if (time === null) problems.push({ field: `${channel}Time`, issue: "time_invalid" })
        return days === null || time === null ? [] : [{ channel, postsPerWeek, days, time }]
    })
    if (problems.length > 0) return { ok: false, problems }
    return {
        ok: true,
        brand: {
            voice: form.voice.trim(),
            avoid: form.avoid.trim(),
            audience: form.audience.trim(),
            cta: form.cta.trim(),
            hashtags: form.hashtags.trim(),
            pillars: pillars.filter((pillar): pillar is BrandPillar => pillar !== null),
            cadence,
        },
    }
}

/** The shape of a post edit the workbench sends. */
export const postEditShape: z.ZodObject<{
    title: z.ZodString
    brief: z.ZodString
    text: z.ZodString
}> = z.object({
    title: z.string().trim().min(1).max(MAX_LINE),
    brief: z.string().max(POST_TEXT_MAX),
    text: z.string().max(POST_TEXT_MAX),
})
