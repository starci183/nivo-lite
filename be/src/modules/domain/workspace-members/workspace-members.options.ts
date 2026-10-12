import type { InjectionToken } from "@nestjs/common"

/** What the workspace-members capability needs from the composition root. */
export interface WorkspaceMembersOptions {
    /** The provider token of the account directory (an `AccountDirectory`) in the app. */
    readonly accounts: InjectionToken
}
