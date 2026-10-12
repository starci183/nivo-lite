import type { InjectionToken } from "@nestjs/common"

/** What the workspace-invites capability needs from its environment, parsed once at the composition root. */
export interface WorkspaceInvitesOptions {
    /** The provider token of the invitation delivery (an `InviteDeliveryPort`) in the app. */
    readonly delivery: InjectionToken
    /** The public origin of the web app, used to build invitation links. */
    readonly siteUrl: string
    /** How many days an invitation link stays valid. */
    readonly inviteDays: number
}
