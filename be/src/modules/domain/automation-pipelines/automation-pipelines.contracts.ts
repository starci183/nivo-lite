import type { ConfigValue } from "@modules/domain/automation-templates"

/** The settings of one pipeline: the saved values over the template defaults. */
export interface PipelineConfig {
    /** The value of a setting, by key. */
    readonly [key: string]: ConfigValue
}

/** The raw pipeline row: one template switched on, off or hidden in one workspace. */
export interface PipelineRow {
    /** The pipeline id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The template key. */
    readonly template_key: string
    /** The display name. */
    readonly name: string
    /** The owning module, or null. */
    readonly module_key: string | null
    /** True when on. */
    readonly enabled: boolean
    /** True when hidden by the owner. */
    readonly dismissed: boolean
    /** The saved settings. */
    readonly config: PipelineConfig
    /** The approved message template. */
    readonly body: string | null
    /** How many times the body was saved. */
    readonly body_version: number
    /** The template version it was created with. */
    readonly template_version: number
    /** The context version the body was written from. */
    readonly based_on_context: number | null
    /** Consecutive approvals without edits. */
    readonly approval_streak: number
    /** When "send by itself" was offered. */
    readonly trust_offered_at: string | null
    /** True when the owner accepted it. */
    readonly auto_send: boolean
    /** When created. */
    readonly created_at: string
    /** When last changed. */
    readonly updated_at: string
}

/** A pipeline, or none before the first switch. */
export type PipelineOrNone = PipelineRow | null

/** An instant as ISO 8601 text, or none. */
export type OptionalInstant = string | null

/** The id and template of a pipeline. */
export interface PipelineKey {
    /** The pipeline id. */
    readonly id: string
    /** The template key. */
    readonly template_key: string
}

/** The editable columns of a pipeline: what a write replaces. */
export interface PipelineWrite {
    /** True when on. */
    readonly enabled: boolean
    /** True when hidden by the owner. */
    readonly dismissed: boolean
    /** The settings. */
    readonly config: PipelineConfig
    /** The approved message template. */
    readonly body: string | null
    /** How many times the body was saved. */
    readonly bodyVersion: number
    /** The context version the body was written from. */
    readonly basedOnContext: number | null
    /** Consecutive approvals without edits. */
    readonly approvalStreak: number
    /** When "send by itself" was offered. */
    readonly trustOfferedAt: string | null
    /** True when the owner accepted it. */
    readonly autoSend: boolean
}
