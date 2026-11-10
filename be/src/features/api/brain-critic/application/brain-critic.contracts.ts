import type { PointState, TypedAnswer } from "@modules/domain/dossier-review"

/** Reading the critique of one document. */
export interface GetBrainCritiqueRequest {
    /** The workspace the caller names in X-Workspace-Id. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
    /** Which points to list; open ones when absent. */
    readonly states?: ReadonlyArray<PointState> | undefined
}

/** Listing the critiqued documents. */
export interface ListBrainCritiquesRequest {
    /** The workspace. */
    readonly workspaceId: string
}

/** Answering one point. */
export interface AnswerBrainCritiqueRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The point. */
    readonly findingId: string
    /** One of its choices. */
    readonly choiceId?: "a" | "b" | undefined
    /** The typed value a choice needs. */
    readonly value?: string | undefined
    /** A typed answer instead of a choice. */
    readonly answer?: TypedAnswer | undefined
    /** A note. */
    readonly note?: string | undefined
}

/** Skipping one point. */
export interface SkipBrainCritiqueRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The point. */
    readonly findingId: string
    /** Why. */
    readonly reason?: string | undefined
}

/** Acting on the critique of one document. */
export interface BrainCritiqueSourceRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
}
