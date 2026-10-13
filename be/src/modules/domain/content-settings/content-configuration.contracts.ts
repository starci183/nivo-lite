import type { ContentPillar } from "@modules/domain/content-pillars"
import type { ContentCadence } from "@modules/domain/content-cadence"

/** An automation the manager can switch. */
export type ContentAutomationKey = "today_reminder" | "offer_draft" | "weekly_summary"

/** The editable brand fields. */
export interface ContentBrandInput {
    /** Voice and style guidance. */
    readonly brandVoice: string
    /** Words and subjects to avoid. */
    readonly avoid: string
    /** The usual call to action. */
    readonly cta: string
    /** Brand hashtags. */
    readonly hashtags: string
}

/** The complete stored brand and automation settings, with defaults. */
export interface ContentBrandSettings {
    /** The workspace that owns this configuration. */
    readonly workspaceId: string
    /** Voice and style guidance. */
    readonly brandVoice: string
    /** Words and subjects to avoid. */
    readonly avoid: string
    /** The usual call to action. */
    readonly cta: string
    /** Brand hashtags. */
    readonly hashtags: ReadonlyArray<string>
    /** The switches for the three content automations. */
    readonly automations: Readonly<Record<ContentAutomationKey, boolean>>
    /** Dedupe marks maintained by the automation jobs. */
    readonly marks: Readonly<Record<string, string>>
}

/** Everything the workbench's settings tab edits. */
export interface ContentConfiguration {
    /** The workspace content themes. */
    readonly pillars: ReadonlyArray<ContentPillar>
    /** The workspace posting rhythms. */
    readonly cadence: ReadonlyArray<ContentCadence>
    /** The brand and automation configuration. */
    readonly settings: ContentBrandSettings
}

/** The number of saved rows. */
export interface SavedContentRows {
    /** The number of saved rows. */
    readonly count: number
}

/** One automation dedupe mark exposed by the workbench. */
export interface ContentAutomationMark {
    /** The automation mark key. */
    readonly key: string
    /** The recorded dedupe value. */
    readonly value: string
}
