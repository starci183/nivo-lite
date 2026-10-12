import type { AcceptedInvite, InvitePreview, InviteResult, PendingInvite } from "@modules/domain/workspace-invites"
import type { MemberListing } from "@modules/domain/workspace-members"
import type { CreatedWorkspace, WorkspaceMembership } from "@modules/domain/workspaces"
import type { CreateInviteRequest as CreateInviteCommandRequest } from "../../application/create-invite.contracts"
import type { AcceptInviteResponse } from "./dto/accept-invite.response"
import type { CreateInviteRequest } from "./dto/create-invite.request"
import type { CreateWorkspaceResponse } from "./dto/create-workspace.response"
import type { InvitePreviewResponse } from "./dto/invite-preview.response"
import type { InviteResultResponse } from "./dto/invite-result.response"
import type { PendingInviteResponse } from "./dto/invites.response"
import type { MemberListingResponse } from "./dto/members.response"
import type { MembershipResponse } from "./dto/memberships.response"

/** Maps the memberships of the caller to the HTTP response. */
export const toMembershipsResponse = (result: ReadonlyArray<WorkspaceMembership>): Array<MembershipResponse> =>
    result.map((entry) => ({ workspace: { ...entry.workspace }, member: { ...entry.member } }))

/** Maps the created workspace to the HTTP response. */
export const toCreateWorkspaceResponse = (result: CreatedWorkspace): CreateWorkspaceResponse => ({
    id: result.id,
})

/** Maps the member listing to the HTTP response. */
export const toMembersResponse = (result: ReadonlyArray<MemberListing>): Array<MemberListingResponse> =>
    result.map((entry) => ({ ...entry }))

/** Maps the pending invitations to the HTTP response. */
export const toInvitesResponse = (result: ReadonlyArray<PendingInvite>): Array<PendingInviteResponse> =>
    result.map((invite) => ({ ...invite }))

/** Maps the HTTP request that invites a person, with the workspace it names, to the command request. */
export const toCreateInviteRequest = (workspaceId: string, input: CreateInviteRequest): CreateInviteCommandRequest => ({
    workspaceId,
    email: input.email,
    role: input.role,
    staffId: input.staffId,
})

/** Maps an invitation result to the HTTP response. */
export const toInviteResultResponse = (result: InviteResult): InviteResultResponse => ({
    email: result.email,
    link: result.link,
    delivery: result.delivery,
})

/** Maps the invitation preview to the HTTP response. */
export const toInvitePreviewResponse = (result: InvitePreview): InvitePreviewResponse => ({
    workspaceName: result.workspaceName,
    email: result.email,
    role: result.role,
    staffName: result.staffName,
    state: result.state,
})

/** Maps the accepted invitation to the HTTP response. */
export const toAcceptInviteResponse = (result: AcceptedInvite): AcceptInviteResponse => ({
    workspaceId: result.workspaceId,
})
