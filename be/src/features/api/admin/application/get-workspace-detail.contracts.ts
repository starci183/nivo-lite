import type { AdminWorkspaceDetail } from "@modules/domain/platform-admin"

/** What getWorkspaceDetail takes. */
export interface GetWorkspaceDetailRequest {
    /** The workspace. */
    readonly workspaceId: string
}

/** What getWorkspaceDetail answers. */
export type GetWorkspaceDetailResult = Readonly<AdminWorkspaceDetail>
