import type { ResumeKeep } from "@modules/domain/agent-connections"

/** What switching an agent live takes. */
export interface SetModuleLiveRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** True to act on channels, false to stay silent. */
    readonly live: boolean
    /** Resume only: whom to keep on the channels another agent of the role answers now; absent asks the caller to choose. */
    readonly keep?: ResumeKeep | undefined
}
