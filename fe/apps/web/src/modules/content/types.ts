/** A social channel a post can be written for. */
export type ContentChannel = "facebook" | "zalo" | "tiktok" | "instagram"

/** Every channel, in display order. */
export const CONTENT_CHANNELS: ReadonlyArray<ContentChannel> = ["facebook", "zalo", "tiktok", "instagram"]
const CHANNEL_SET: ReadonlySet<unknown> = new Set(CONTENT_CHANNELS)

/** Narrows an unknown value to a channel. */
export const isContentChannel = (value: unknown): value is ContentChannel => CHANNEL_SET.has(value)

/** Where a post stands between idea and published. */
export type ContentStatus = "idea" | "draft" | "waiting_approval" | "approved" | "published" | "skipped"

/** Every status, in display order. */
export const CONTENT_STATUSES: ReadonlyArray<ContentStatus> = [
    "idea",
    "draft",
    "waiting_approval",
    "approved",
    "published",
    "skipped",
]

const STATUS_SET: ReadonlySet<unknown> = new Set(CONTENT_STATUSES)

/** Narrows an unknown value to a status. */
export const isContentStatus = (value: unknown): value is ContentStatus => STATUS_SET.has(value)

/** The per-channel limits (content.templates.ts). */
export interface ChannelRule {
    readonly key: ContentChannel
    readonly short: string
    readonly max_chars: number
    readonly hashtags: { readonly min: number; readonly max: number }
}

/** A content theme of a workspace. */
export interface Pillar {
    readonly id: string
    readonly workspace_id: string
    readonly name: string
    readonly description: string
    readonly weight: number
    readonly sort: number
    readonly active: boolean
}

/** How often one channel is posted to. */
export interface Cadence {
    readonly id: string
    readonly workspace_id: string
    readonly channel: ContentChannel
    readonly posts_per_week: number
    readonly days: ReadonlyArray<number>
    readonly post_time: string
}

/** The switchable automations (they run in the back end). */
export type AutomationKey = "today_reminder" | "offer_draft" | "weekly_summary"

/** Every automation key. */
export const AUTOMATION_KEYS: ReadonlyArray<AutomationKey> = ["today_reminder", "offer_draft", "weekly_summary"]

/** Which automations are switched on. */
export type AutomationFlags = Readonly<Record<AutomationKey, boolean>>

/** Brand voice and automation settings of a workspace. */
export interface ContentSettings {
    readonly workspace_id: string
    readonly brand_voice: string
    readonly avoid: string
    readonly cta: string
    readonly hashtags: ReadonlyArray<string>
    readonly automations: AutomationFlags
    readonly marks: Readonly<Record<string, string>>
}

/** The text of one post for one channel. */
export interface Variant {
    readonly text: string
    readonly hashtags: ReadonlyArray<string>
    readonly note: string
}

/** The texts of a post by channel. */
export type Variants = Partial<Record<ContentChannel, Variant>>

/** A picture or video attached to a post. */
export interface MediaRef {
    readonly kind: "media" | "video_render"
    readonly path?: string | undefined
    readonly id?: string | undefined
    readonly name: string
    readonly suggested?: boolean | undefined
}

/** A link attached to a post. */
export interface LinkRef {
    readonly url: string
    readonly label: string
}

/** One line of a post's history. */
export interface EvidenceLine {
    readonly at: string
    readonly kind: string
    readonly by: string
    readonly text: string
}

/** Proof that a post was posted by hand on a channel. */
export interface PublishedMark {
    readonly at: string
    readonly by: string
    readonly url: string
    readonly how: string
}

/** Where a post came from. */
export type ContentSource = "manual" | "plan" | "quick" | "offer" | "automation"

/** One post. */
export interface ContentItem {
    readonly id: string
    readonly workspace_id: string
    readonly plan_id: string | null
    readonly title: string
    readonly brief: string
    readonly pillar_id: string | null
    readonly channels: ReadonlyArray<ContentChannel>
    readonly scheduled_at: string | null
    readonly status: ContentStatus
    readonly variants: Variants
    readonly hashtags: ReadonlyArray<string>
    readonly media: ReadonlyArray<MediaRef>
    readonly links: ReadonlyArray<LinkRef>
    readonly holiday_key: string | null
    readonly evidence: ReadonlyArray<EvidenceLine>
    readonly published: Partial<Record<ContentChannel, PublishedMark>>
    readonly work_item_id: string | null
    readonly drafted_at: string | null
    readonly approved_by: string | null
    readonly approved_at: string | null
    readonly published_at: string | null
    readonly source: ContentSource
    readonly created_by: string
    readonly created_at: string
    readonly updated_at: string
}

/** A rendered video the editor can attach. */
export interface VideoOption {
    readonly id: string
    readonly name: string
    readonly createdAt: string
    readonly durationMs: number | null
}

/** Short-lived URLs of a stored file. */
export interface SignedUrls {
    readonly view: string
    readonly download: string
}

/** The last month plan that finished. */
export interface LastPlan {
    readonly month: string
    readonly ideas: number
    readonly ms: number | null
    readonly createdAt: string
}

/** The four numbers of the dashboard ribbon. */
export interface ContentFigures {
    readonly awaitingApproval: number
    readonly published30: number
    readonly next: { readonly at: string; readonly title: string } | null
    readonly pillars: { readonly covered: number; readonly total: number }
}

/** Everything the content workbench shows, read with the member's own session. */
export interface ContentWorkbenchData {
    readonly nowIso: string
    readonly workspaceId: string
    readonly canManage: boolean
    readonly items: ReadonlyArray<ContentItem>
    readonly pillars: ReadonlyArray<Pillar>
    readonly cadence: ReadonlyArray<Cadence>
    readonly settings: ContentSettings
    readonly library: ReadonlyArray<MediaRef>
    readonly videos: ReadonlyArray<VideoOption>
    readonly urls: Readonly<Record<string, SignedUrls>>
    readonly lastPlan: LastPlan | null
    readonly figures: ContentFigures | null
}

/** The settings of a workspace that saved nothing yet. */
export const defaultSettings = (workspaceId: string): ContentSettings => ({
    workspace_id: workspaceId,
    brand_voice: "",
    avoid: "",
    cta: "",
    hashtags: [],
    automations: { today_reminder: false, offer_draft: false, weekly_summary: false },
    marks: {},
})

/** A variant with no text. */
export const emptyVariant = (): Variant => ({ text: "", hashtags: [], note: "" })

/** A status change of a post. */
export type ItemTransition = "skip" | "restore" | "reopen" | "delete"
