import type { InviteResent } from "@modules/domain/platform-admin"

/** The HTTP response of resendWorkspaceInvite. */
export class ResendWorkspaceInviteResponse {
    /** The email the invitation was for. */
    email!: string

    /** How the invitation reached the person. */
    delivery!: InviteResent["delivery"]
}
