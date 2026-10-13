import type { WorkspaceMembership } from "@modules/domain/workspaces"
import type { MembershipType } from "./dto/memberships.type"

/** Maps the memberships of the caller to the GraphQL type. */
export const toMembershipsType = (result: ReadonlyArray<WorkspaceMembership>): Array<MembershipType> =>
    result.map((entry) => ({ workspace: { ...entry.workspace }, member: { ...entry.member } }))
