import type { LoyaltyProgramQuery } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"

const query1 = gql`
    query LoyaltyProgram {
        loyaltyProgram {
            config {
                birthday {
                    enabled
                    note
                    points
                    rewardKey
                }
                earn {
                    categories {
                        label
                        match
                        perThousandVnd
                    }
                    minOrderVnd
                    perThousandVnd
                    perVisit
                    trigger
                }
                expiry {
                    months
                    warnDays
                }
                promo {
                    batch
                    hourFrom
                    hourTo
                    maxPerMonth
                }
                tiers {
                    benefit
                    key
                    minSpendVnd
                    multiplier
                    name
                    winbackDays
                }
            }
            program {
                config {
                    birthday {
                        enabled
                        note
                        points
                        rewardKey
                    }
                    earn {
                        categories {
                            label
                            match
                            perThousandVnd
                        }
                        minOrderVnd
                        perThousandVnd
                        perVisit
                        trigger
                    }
                    expiry {
                        months
                        warnDays
                    }
                    promo {
                        batch
                        hourFrom
                        hourTo
                        maxPerMonth
                    }
                    tiers {
                        benefit
                        key
                        minSpendVnd
                        multiplier
                        name
                        winbackDays
                    }
                }
                createdAt
                enabled
                name
                slug
                workspaceId
            }
            rewards {
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
    }
`

enum QueryLoyaltyProgram {
    Query1 = "query1",
}

const queryMap: Record<QueryLoyaltyProgram, DocumentNode> = {
    [QueryLoyaltyProgram.Query1]: query1,
}

/** Apollo params for {@link queryLoyaltyProgram}. */
type QueryLoyaltyProgramParams = QueryParams<QueryLoyaltyProgram>

/** The loyalty programme settings of the active workspace for the settings form. */
export const queryLoyaltyProgram = async ({
    query = QueryLoyaltyProgram.Query1,
    signal,
}: QueryLoyaltyProgramParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query<LoyaltyProgramQuery>({ query: queryMap[query] })
}
