/** What the workspace-invites capability needs from its environment, parsed once at the composition root. */
export interface WorkspaceInvitesOptions {
    /** The public origin of the web app, used to build invitation links. */
    readonly siteUrl: string
    /** How many days an invitation link stays valid. */
    readonly inviteDays: number
}
