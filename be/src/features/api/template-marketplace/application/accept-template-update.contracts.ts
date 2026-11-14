import type { AgreedRightRequest } from "@modules/domain/agent-graphs"

/** What the AcceptTemplateUpdate operation takes. */
export interface AcceptTemplateUpdateRequest {
    /** The workspaceId. */
    readonly workspaceId: string
    /** The installationId. */
    readonly installationId: string
    /** The unitIds. */
    readonly unitIds: ReadonlyArray<string>
    /** The entries on connected accounts the owner agreed, as the refusal listed them; absent when nothing was asked of the owner. */
    readonly agreedRights?: ReadonlyArray<AgreedRightRequest> | null | undefined
}
