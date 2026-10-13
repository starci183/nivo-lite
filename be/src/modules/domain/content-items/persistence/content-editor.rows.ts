import type {
    ContentEvidence,
    ContentLink,
    ContentMediaRef,
    ContentVariant,
    PublishMark,
} from "../content-editor.contracts"

/** A complete content_items row, with PostgreSQL timestamps returned as Date or ISO text. */
export interface ContentEditorRow {
    /** The stored row identifier. */
    readonly id: string
    /** The workspace that owns this row. */
    readonly workspace_id: string
    /** The originating editorial plan, when any. */
    readonly plan_id: string | null
    /** The post title. */
    readonly title: string
    /** The writing brief. */
    readonly brief: string
    /** The content theme, when assigned. */
    readonly pillar_id: string | null
    /** The channels selected for publication. */
    readonly channels: Array<string>
    /** The scheduled publication instant, when set. */
    readonly scheduled_at: Date | string | null
    /** The current editorial lifecycle state. */
    readonly status: string
    /** The channel-specific draft texts. */
    readonly variants: Record<string, ContentVariant>
    /** The selected hashtags. */
    readonly hashtags: Array<string>
    /** The selected image and video attachments. */
    readonly media: Array<ContentMediaRef>
    /** The supporting links. */
    readonly links: Array<ContentLink>
    /** The calendar occasion, when selected. */
    readonly holiday_key: string | null
    /** The bounded editorial history. */
    readonly evidence: Array<ContentEvidence>
    /** Publication evidence indexed by channel. */
    readonly published: Record<string, PublishMark>
    /** The associated approval decision, when any. */
    readonly work_item_id: string | null
    /** The first draft instant, when any. */
    readonly drafted_at: Date | string | null
    /** The approving actor, when any. */
    readonly approved_by: string | null
    /** The approval instant, when any. */
    readonly approved_at: Date | string | null
    /** The publication instant, when any. */
    readonly published_at: Date | string | null
    /** The source that created the idea. */
    readonly source: string
    /** The actor that created the post. */
    readonly created_by: string
    /** The creation instant. */
    readonly created_at: Date | string
    /** The most recent update instant. */
    readonly updated_at: Date | string
}

/** Aggregates calculated by the workbench query. */
export interface ContentFiguresRow {
    /** The number of posts awaiting approval. */
    readonly awaiting_approval: number
    /** The number of posts published in the last thirty days. */
    readonly published_30: number
    /** The number of active themes represented in the current month. */
    readonly covered: number
    /** The total number of active themes. */
    readonly total: number
}

/** The latest completed plan. */
export interface ContentPlanSummaryRow {
    /** The editorial plan month. */
    readonly month: string
    /** The number of planned ideas. */
    readonly idea_count: number
    /** The AI planning duration in milliseconds, when recorded. */
    readonly ai_ms: number | null
    /** The creation instant. */
    readonly created_at: Date | string
}

/** A workspace-scoped identifier selected for an editor write. */
export interface ContentEditorIdRow {
    /** The stored row identifier. */
    readonly id: string
}
