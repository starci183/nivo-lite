import { z, type ZodType } from "zod"
import { MAX_LINE } from "../../../shared/bounds"
import starterPillars from "./starter-pillars.json"
import { CONTENT_CHANNELS, wallTimeOf, type ContentChannel } from "./post"

/** The longest time text a rhythm keeps (`HH:MM`). */
const TIME_TEXT_MAX = 5

/** The most content themes a brand holds. */
export const PILLARS_MAX = 12

/** The heaviest weight a theme takes. */
export const PILLAR_WEIGHT_MAX = 10

/** The most posts a week one channel takes. */
export const POSTS_PER_WEEK_MAX = 14

/** One content theme: its name, what it covers, its share of the posts and whether the plan uses it. */
export type BrandPillar = {
    /** Its name. */
    readonly name: string
    /** What it covers, in a short line; empty when none. */
    readonly description: string
    /** Its share of the posts, 0 (paused) to 10. */
    readonly weight: number
    /** Whether the plan uses it. */
    readonly active: boolean
}

/** The themes of a brand, as the entity keeps them. */
export type BrandPillars = {
    /** The entries, in order. */
    readonly items: ReadonlyArray<BrandPillar>
}

/** The posting rhythm of one channel: posts a week, the weekdays (Monday 1 to Sunday 7; none: spread by the count) and the time. */
export type BrandChannelCadence = {
    /** The social channel. */
    readonly channel: ContentChannel
    /** How many posts a week the channel takes. */
    readonly postsPerWeek: number
    /** The weekdays it posts on, Monday 1 to Sunday 7; none spreads the posts by the count. */
    readonly days: ReadonlyArray<number>
    /** The wall-clock time on the shop's clock, `HH:MM`; empty when none. */
    readonly time: string
}

/** The rhythm of every channel of a brand, as the entity keeps it. */
export type BrandCadence = {
    /** The entries, in order. */
    readonly items: ReadonlyArray<BrandChannelCadence>
}

const pillarShape = z.object({
    name: z.string().trim().min(1).max(MAX_LINE),
    description: z.string().max(MAX_LINE),
    weight: z.number().int().min(0).max(PILLAR_WEIGHT_MAX),
    active: z.boolean(),
})

/** The shape the entity keeps the themes in. */
export const brandPillarsShape: ZodType<BrandPillars> = z.object({ items: z.array(pillarShape).max(PILLARS_MAX) })

const channelCadenceShape = z.object({
    channel: z.enum(CONTENT_CHANNELS),
    postsPerWeek: z.number().int().min(0).max(POSTS_PER_WEEK_MAX),
    days: z.array(z.number().int().min(1).max(7)).max(7),
    time: z.string().max(TIME_TEXT_MAX).refine((value) => wallTimeOf(value) !== null),
})

/** The shape the entity keeps the rhythm in: one row per channel at most. */
export const brandCadenceShape: ZodType<BrandCadence> = z.object({
    items: z
        .array(channelCadenceShape)
        .max(CONTENT_CHANNELS.length)
        .refine((items) => new Set(items.map((item) => item.channel)).size === items.length),
})

/** The brand the plan and the writer read, flat. */
export type ContentBrand = {
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
    readonly pillars: ReadonlyArray<BrandPillar>
    /** The posting rhythm of each channel. */
    readonly cadence: ReadonlyArray<BrandChannelCadence>
}

/** The starter themes of a brand that never saved one, carried from the content presets (in Vietnamese, the shop's language), weighted 3, 3, 2, 1, 1. */
export const STARTER_PILLARS: ReadonlyArray<BrandPillar> = starterPillars

/** The starter rhythm (carried from the content presets): Facebook three evenings a week, Zalo OA one morning. */
export const STARTER_CADENCE: ReadonlyArray<BrandChannelCadence> = [
    { channel: "facebook", postsPerWeek: 3, days: [2, 4, 6], time: "19:30" },
    { channel: "zalo", postsPerWeek: 1, days: [3], time: "10:00" },
]

/** The brand of a workspace that never saved one: no voice of its own yet, the starter themes and rhythm. */
export const STARTER_BRAND: ContentBrand = {
    voice: "",
    avoid: "",
    audience: "",
    cta: "",
    hashtags: "",
    pillars: STARTER_PILLARS,
    cadence: STARTER_CADENCE,
}

/** The brand's own hashtags, `#word` each, deduplicated in their order; written words split on spaces and commas. */
export const cleanHashtags = (list: ReadonlyArray<string>): ReadonlyArray<string> => [
    ...new Set(
        list
            .flatMap((value) => value.split(/[\s,]+/u))
            .map((value) => value.replace(/^#+/u, "").replaceAll("#", ""))
            .filter((word) => word !== "")
            .map((word) => `#${word}`),
    ),
]

/** The brand's voice, limits and themes as one block of the prompt the plan and the writer run with. */
export const brandBlockOf = (brand: ContentBrand): string =>
    [
        brand.audience === "" ? "" : `Audience: ${brand.audience}`,
        brand.voice === "" ? "Brand voice: friendly, clear, useful, and restrained." : `Brand voice: ${brand.voice}`,
        brand.avoid === "" ? "" : `Prohibited claims and limits: ${brand.avoid}`,
        brand.cta === "" ? "" : `Preferred call to action: ${brand.cta}`,
        `Themes: ${brand.pillars
            .filter((pillar) => pillar.active)
            .map((pillar) => (pillar.description === "" ? pillar.name : `${pillar.name} (${pillar.description})`))
            .join("; ")}`,
    ]
        .filter((line) => line !== "")
        .join("\n")
