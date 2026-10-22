import type { MemberGrantChange } from "@modules/domain/member-grants"

/** What saving the approval limits of one action takes. */
export interface SaveMemberGrantsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The action key. */
    readonly action: string
    /** The members that may approve it, each with a limit; a member not named loses theirs. */
    readonly grants: ReadonlyArray<MemberGrantChange>
}
