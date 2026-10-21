import type { DelegationIdRow, DelegationRenderRow } from "./persistence/video-delegations.rows"

/** A delegation AI Editor records when another agent hands it a script. */
export interface NewVideoDelegation {
    /** The workspace. */
    readonly workspaceId: string
    /** The render_script work item that carried the script. */
    readonly workItemId: string
    /** The project made of the script. */
    readonly projectId: string
    /** The delegating module. */
    readonly sourceModule: string
    /** The AI Marketing draft it belongs to, or null. */
    readonly contentItemId: string | null
    /** The target channels. */
    readonly channels: ReadonlyArray<string>
}

/** A delegation's ids, or null when there is none. */
export type OptionalDelegationId = DelegationIdRow | null

/** A settled render's delegation, or null when nobody delegated it. */
export type OptionalDelegationRender = DelegationRenderRow | null

/** Why a render failed, as the renderer reported it, or null when it gave no reason. */
export type OptionalFailureReason = string | null
