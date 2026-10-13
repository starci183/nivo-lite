import type { MemberListing } from "@modules/domain/workspace-members"
import type { MemberListingType } from "./dto/member-listing.type"

/** Maps the member listing to the GraphQL type. */
export const toMemberListingsType = (result: ReadonlyArray<MemberListing>): Array<MemberListingType> =>
    result.map((entry) => ({ ...entry }))
