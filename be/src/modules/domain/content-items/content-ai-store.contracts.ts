import type { ContentEvidence, ContentMediaRef, ContentVariant } from "./content-editor.contracts"

/** A content row written by an AI application step. */
export interface ContentAiItemRef {
    /** The written row. */
    readonly id: string
}

/** The newly created quick idea and the revision its queued draft may replace. */
export interface ContentQuickIdeaCreated extends ContentAiItemRef {
    /** The editor revision at creation, before the generation job is published. */
    readonly updatedAt: string
}

/** A pasted topic and the channels to draft. */
export interface ContentQuickIdeaInput {
    /** The complete owner-supplied topic. */
    readonly topic: string
    /** Supported channels selected by the caller. */
    readonly channels: ReadonlyArray<string>
}

/** Text generated for an existing editable idea. */
export interface ContentGeneratedDraft {
    /** Text, hashtags and notes for each channel. */
    readonly variants: Readonly<Record<string, ContentVariant>>
    /** Normalized post or brand hashtags. */
    readonly hashtags: ReadonlyArray<string>
    /** The attachments selected for this post. */
    readonly media?: ReadonlyArray<ContentMediaRef>
    /** The social channels requested for the post. */
    readonly channels?: ReadonlyArray<string>
    /** The content theme selected for this idea. */
    readonly pillarId?: string
    /** The bounded editorial title. */
    readonly title?: string
    /** The completion instant of this draft. */
    readonly draftedAt?: string
    /** Audit lines describing the generated work. */
    readonly evidence?: ReadonlyArray<ContentEvidence>
    /** The editor revision that the queued draft may replace. */
    readonly expectedUpdatedAt?: string
}

/** One deterministically scheduled idea in a generated plan. */
export interface ContentPlannedIdea {
    /** The bounded editorial title. */
    readonly title: string
    /** The angle and verified facts of the idea. */
    readonly brief: string
    /** The content theme selected for this idea. */
    readonly pillarId: string
    /** The social channels requested for the post. */
    readonly channels: ReadonlyArray<string>
    /** The deterministic posting instant. */
    readonly scheduledAt: string
    /** The pinned occasion key, if any. */
    readonly holidayKey: string | null
}

/** A completed plan, applied atomically after every generation succeeds. */
export interface ContentGeneratedPlan {
    /** The requested calendar month in YYYY-MM form. */
    readonly month: string
    /** The person who requested this plan. */
    readonly actor: string
    /** Every generated idea ready for atomic application. */
    readonly items: ReadonlyArray<ContentPlannedIdea>
    /** The plan evidence and deterministic scheduling details. */
    readonly meta: Record<string, unknown>
    /** The engine generations that produced this plan. */
    readonly generationId: string
    /** The complete generation duration in milliseconds. */
    readonly aiMs: number
}

/** The persisted plan and idea count. */
export interface ContentAppliedPlan {
    /** The saved editorial plan. */
    readonly planId: string
    /** The number of generated ideas. */
    readonly ideas: number
}
