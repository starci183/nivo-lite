import type { InviteResent } from "@modules/domain/platform-admin"

/** What resendWorkspaceInvite takes. */
export interface ResendWorkspaceInviteRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The pending invitation. */
    readonly inviteId: string
}

/** What resendWorkspaceInvite answers. */
export type ResendWorkspaceInviteResult = Readonly<InviteResent>
