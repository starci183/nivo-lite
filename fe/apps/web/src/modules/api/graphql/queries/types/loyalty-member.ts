import type { Query, QueryLoyaltyMemberArgs } from "../../__generated__/schema"

/** The input of the `loyaltyMember` query. */
export type QueryLoyaltyMemberRequest = QueryLoyaltyMemberArgs["input"]

/** The response of the `loyaltyMember` query. */
export type QueryLoyaltyMemberResponse = Pick<Query, "loyaltyMember">
