import type { LoyaltyMemberQuery } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { QueryLoyaltyMemberRequest } from "./types/loyalty-member"

const query1 = gql`
    query LoyaltyMember($input: LoyaltyMemberInput!) {
        loyaltyMember(input: $input) {
            expiring {
                firstAt
                points
            }
            ledger {
                amountVnd
                by
                customerId
                evidence
                expiresAt
                id
                kind
                occurredAt
                orderId
                points
                ref
                rewardId
                workItemId
            }
            member {
                birthday
                email
                id
                joinedAt
                lastVisitAt
                lifetimeSpendVnd
                name
                note
                phone
                points
                tierKey
                visits
            }
            nextTier {
                missingVnd
                tier {
                    benefit
                    key
                    minSpendVnd
                    multiplier
                    name
                    winbackDays
                }
            }
            rewards {
                block {
                    code
                    params {
                        key
                        value
                    }
                }
                reward {
                    active
                    id
                    key
                    kind
                    minTierKey
                    name
                    note
                    perCustomerLimit
                    percent
                    pointsCost
                    stock
                    valueVnd
                }
            }
            tierName
        }
    }
`

enum QueryLoyaltyMember {
    Query1 = "query1",
}

const queryMap: Record<QueryLoyaltyMember, DocumentNode> = {
    [QueryLoyaltyMember.Query1]: query1,
}

/** Apollo params for {@link queryLoyaltyMember}. */
type QueryLoyaltyMemberParams = QueryParams<QueryLoyaltyMember, QueryLoyaltyMemberRequest> & {
    request: QueryLoyaltyMemberRequest
}

/** One loyalty member with the ledger timeline and the rewards they can redeem now. */
export const queryLoyaltyMember = async ({
    query = QueryLoyaltyMember.Query1,
    request,
    signal,
}: QueryLoyaltyMemberParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query<LoyaltyMemberQuery, InputVariables<QueryLoyaltyMemberRequest>>({
        query: queryMap[query],
        variables: { input: request },
    })
}
