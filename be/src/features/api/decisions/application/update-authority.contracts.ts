import type { AuthorityPatch } from "@modules/domain/authority"

/** What updating the authority takes. */
export interface UpdateAuthorityRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The fields to change; omitted fields stay as they are. */
    readonly patch: AuthorityPatch
}
