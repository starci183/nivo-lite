import type { PipelinePatch } from "@modules/domain/automations"

/** What update pipeline takes. */
export interface UpdatePipelineRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The template. */
    readonly templateKey: string
    /** What to change. */
    readonly patch: PipelinePatch
}
