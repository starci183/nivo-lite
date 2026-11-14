import type { EnterpriseKeySet } from "@modules/domain/platform-admin"

/** What setWorkspaceEnterpriseKey takes. */
export interface SetWorkspaceEnterpriseKeyRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The enterprise identifier to carry; null clears it, making the workspace an ordinary one. */
    readonly enterpriseKey: string | null
}

/** What setWorkspaceEnterpriseKey answers. */
export type SetWorkspaceEnterpriseKeyResult = Readonly<EnterpriseKeySet>
