import type { Database, Json } from "../../../../../../../supabase/types/database.types"
import {
    defaultSettings,
    isContentChannel,
    isContentStatus,
    type AutomationFlags,
    type ContentChannel,
    type Cadence,
    type ContentItem,
    type ContentSettings,
    type EvidenceLine,
    type LinkRef,
    type MediaRef,
    type Pillar,
    type PublishedMark,
    type Variant,
    type Variants,
} from "@/modules/content"

/** A jsonb value that is never null. */
export type JsonValue = NonNullable<Json>

/** A stored post row. */
export type ContentItemRow = Database["public"]["Tables"]["content_items"]["Row"]
/** A stored pillar row. */
export type ContentPillarRow = Database["public"]["Tables"]["content_pillars"]["Row"]
/** A stored cadence row. */
export type ContentCadenceRow = Database["public"]["Tables"]["content_cadence"]["Row"]
/** A stored settings row. */
export type ContentSettingsRow = Database["public"]["Tables"]["content_settings"]["Row"]

/** The shape of a plain object read from jsonb. */
type JsonObject = { readonly [key: string]: Json | undefined }

const isObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const asText = (value: unknown): string => (typeof value === "string" ? value : "")

const asList = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [])

const parseVariant = (value: unknown): Variant | null =>
    isObject(value)
        ? {
              text: asText(value.text),
              hashtags: asList(value.hashtags).map(String),
              note: asText(value.note),
          }
        : null

/** Reads the per-channel texts of a post from jsonb, dropping what is not a channel. */
export const parseVariants = (value: unknown): Variants => {
    if (!isObject(value)) return {}
    const entries = Object.entries(value).flatMap(([key, raw]) => {
        const variant = parseVariant(raw)
        return isContentChannel(key) && variant !== null ? [[key, variant] as const] : []
    })
    return Object.fromEntries(entries)
}

/** Reads the media of a post from jsonb. */
export const parseMedia = (value: unknown): Array<MediaRef> =>
    asList(value).flatMap((raw) => {
        if (!isObject(raw)) return []
        const kind = raw.kind === "video_render" ? "video_render" : "media"
        const path = asText(raw.path)
        const id = asText(raw.id)
        return [
            {
                kind,
                name: asText(raw.name),
                ...(path === "" ? {} : { path }),
                ...(id === "" ? {} : { id }),
                ...(raw.suggested === true ? { suggested: true } : {}),
            },
        ]
    })

/** Reads the links of a post from jsonb. */
export const parseLinks = (value: unknown): Array<LinkRef> =>
    asList(value).flatMap((raw) => (isObject(raw) ? [{ url: asText(raw.url), label: asText(raw.label) }] : []))

/** Reads the history of a post from jsonb. */
export const parseEvidence = (value: unknown): Array<EvidenceLine> =>
    asList(value).flatMap((raw) =>
        isObject(raw)
            ? [{ at: asText(raw.at), kind: asText(raw.kind), by: asText(raw.by), text: asText(raw.text) }]
            : [],
    )

/** Reads the posted-by-hand marks of a post from jsonb. */
export const parsePublished = (value: unknown): Partial<Record<ContentItem["channels"][number], PublishedMark>> => {
    if (!isObject(value)) return {}
    const entries = Object.entries(value).flatMap(([key, raw]) =>
        isContentChannel(key) && isObject(raw)
            ? [[key, { at: asText(raw.at), by: asText(raw.by), url: asText(raw.url), how: asText(raw.how) }] as const]
            : [],
    )
    return Object.fromEntries(entries)
}

const SOURCES: ReadonlyArray<ContentItem["source"]> = ["manual", "plan", "quick", "offer", "automation"]

/** A stored post row to a typed post. */
export const toItem = (row: ContentItemRow): ContentItem => {
    const channels = row.channels.filter(isContentChannel)
    return {
        id: row.id,
        workspace_id: row.workspace_id,
        plan_id: row.plan_id,
        title: row.title,
        brief: row.brief,
        pillar_id: row.pillar_id,
        channels: channels.length > 0 ? channels : ["facebook"],
        scheduled_at: row.scheduled_at,
        status: isContentStatus(row.status) ? row.status : "idea",
        variants: parseVariants(row.variants),
        hashtags: row.hashtags,
        media: parseMedia(row.media),
        links: parseLinks(row.links),
        holiday_key: row.holiday_key,
        evidence: parseEvidence(row.evidence),
        published: parsePublished(row.published),
        work_item_id: row.work_item_id,
        drafted_at: row.drafted_at,
        approved_by: row.approved_by,
        approved_at: row.approved_at,
        published_at: row.published_at,
        source: SOURCES.find((source) => source === row.source) ?? "manual",
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

/** A stored pillar row to a typed pillar. */
export const toPillar = (row: ContentPillarRow): Pillar => ({ ...row })

/** A stored cadence row to a typed cadence (rows of an unknown channel are dropped). */
export const toCadence = (row: ContentCadenceRow): Array<Cadence> =>
    isContentChannel(row.channel) ? [{ ...row, channel: row.channel }] : []

const parseAutomations = (value: unknown, base: AutomationFlags): AutomationFlags =>
    isObject(value)
        ? {
              today_reminder: value.today_reminder === true,
              offer_draft: value.offer_draft === true,
              weekly_summary: value.weekly_summary === true,
          }
        : base

/** A stored settings row (or none) to typed settings. */
export const toSettings = (workspaceId: string, row: ContentSettingsRow | null): ContentSettings => {
    const base = defaultSettings(workspaceId)
    if (row === null) return base
    const marks = isObject(row.marks)
        ? Object.fromEntries(Object.entries(row.marks).flatMap(([key, v]) => (typeof v === "string" ? [[key, v]] : [])))
        : {}
    return {
        workspace_id: workspaceId,
        brand_voice: row.brand_voice,
        avoid: row.avoid,
        cta: row.cta,
        hashtags: row.hashtags,
        automations: parseAutomations(row.automations, base.automations),
        marks,
    }
}

/** The jsonb form of the per-channel texts. */
export const variantsToJson = (variants: Variants): JsonValue =>
    Object.fromEntries(
        Object.entries(variants).flatMap(([key, v]) =>
            isContentChannel(key) && v !== undefined
                ? [[key, { text: v.text, hashtags: [...v.hashtags], note: v.note }]]
                : [],
        ),
    )

/** The jsonb form of the media of a post. */
export const mediaToJson = (media: ReadonlyArray<MediaRef>): JsonValue =>
    media.map((m) => ({
        kind: m.kind,
        name: m.name,
        ...(m.path === undefined ? {} : { path: m.path }),
        ...(m.id === undefined ? {} : { id: m.id }),
        ...(m.suggested === true ? { suggested: true } : {}),
    }))

/** The jsonb form of the links of a post. */
export const linksToJson = (links: ReadonlyArray<LinkRef>): JsonValue =>
    links.map((l) => ({ url: l.url, label: l.label }))

/** The jsonb form of the history of a post. */
export const evidenceToJson = (lines: ReadonlyArray<EvidenceLine>): JsonValue =>
    lines.map((e) => ({ at: e.at, kind: e.kind, by: e.by, text: e.text }))

/** The jsonb form of the posted-by-hand marks of a post. */
export const publishedToJson = (marks: ContentItem["published"]): JsonValue =>
    Object.fromEntries(
        Object.entries(marks).flatMap(([key, m]) =>
            m === undefined ? [] : [[key, { at: m.at, by: m.by, url: m.url, how: m.how }]],
        ),
    )

/** The newest history lines a post keeps. */
export const EVIDENCE_LIMIT = 60

/** A validated new post. */
export interface NewItemInput {
    readonly title: string
    readonly scheduledAt: string | null
    readonly channels: ReadonlyArray<ContentChannel>
    readonly pillarId: string | null
}

/** A validated edit of a post; only the fields present are changed. */
export interface ItemPatchInput {
    readonly title?: string
    readonly brief?: string
    readonly pillarId?: string | null
    readonly channels?: ReadonlyArray<ContentChannel>
    readonly scheduledAt?: string | null
    readonly variants?: Variants
    readonly hashtags?: ReadonlyArray<string>
    readonly links?: ReadonlyArray<LinkRef>
    readonly media?: ReadonlyArray<MediaRef>
}

const optionalText = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined
    return typeof value === "string" ? value : null
}

const nullableText = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined
    return typeof value === "string" ? value : null
}

const channelList = (value: unknown): Array<ContentChannel> | null =>
    Array.isArray(value) ? [...new Set(value.filter(isContentChannel))] : null

const validInstant = (value: string | null | undefined): boolean =>
    value === undefined || value === null || !Number.isNaN(Date.parse(value))

/** Checks the input of a create command. */
export const parseNewItem = (input: unknown): NewItemInput | null => {
    if (!isObject(input) || typeof input.title !== "string") return null
    const channels = channelList(input.channels)
    const scheduledAt = nullableText(input.scheduledAt) ?? null
    if (channels === null || !validInstant(scheduledAt)) return null
    return { title: input.title, scheduledAt, channels, pillarId: nullableText(input.pillarId) ?? null }
}

/** Checks the input of a save command. */
export const parseItemPatch = (input: unknown): ItemPatchInput | null => {
    if (!isObject(input)) return null
    const channels = input.channels === undefined ? undefined : channelList(input.channels)
    const scheduledAt = nullableText(input.scheduledAt)
    if (channels === null || !validInstant(scheduledAt)) return null
    return {
        ...(input.title === undefined ? {} : { title: optionalText(input.title) ?? "" }),
        ...(input.brief === undefined ? {} : { brief: optionalText(input.brief) ?? "" }),
        ...(input.pillarId === undefined ? {} : { pillarId: nullableText(input.pillarId) ?? null }),
        ...(channels === undefined ? {} : { channels }),
        ...(scheduledAt === undefined ? {} : { scheduledAt }),
        ...(input.variants === undefined ? {} : { variants: parseVariants(input.variants) }),
        ...(input.hashtags === undefined ? {} : { hashtags: asList(input.hashtags).map(String) }),
        ...(input.links === undefined ? {} : { links: parseLinks(input.links) }),
        ...(input.media === undefined ? {} : { media: parseMedia(input.media) }),
    }
}
