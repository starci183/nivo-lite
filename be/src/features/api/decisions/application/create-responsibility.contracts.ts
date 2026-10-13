import type { NewResponsibility } from "@modules/domain/responsibilities"

/** What creating a responsibility takes. */
export interface CreateResponsibilityRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** What the responsibility is. */
    readonly input: NewResponsibility
}
