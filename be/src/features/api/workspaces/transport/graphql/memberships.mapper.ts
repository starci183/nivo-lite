import type { LobbyMembership } from "@modules/domain/billing"
import type { MembershipType } from "./dto/memberships.type"

/** Maps the memberships of the caller, with their lobby facts, to the GraphQL type. */
export const toMembershipsType = (result: ReadonlyArray<LobbyMembership>): Array<MembershipType> =>
    result.map((entry) => ({
        workspace: { ...entry.workspace },
        member: { ...entry.member },
        lobby: { ...entry.lobby },
    }))
