import type { LoyaltyBoardQuery } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"

const query1 = gql`
    query LoyaltyBoard {
        loyaltyBoard {
            campaigns {
                createdAt
                createdBy
                draft
                draftMs
                errorCode
                failed
                finishedAt
                id
                messageDraft
                name
                queued
                recipients
                segment {
                    birthdayThisMonth
                    inactiveDays
                    minSpendVnd
                    tiers
                }
                sent
                skipped
                status
                workItemId
            }
            canManage
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
            figures {
                activeMembers
                atRisk
                members
                pointsIssued30d
                pointsRedeemed30d
                redemptions30d
            }
            members {
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
            nowIso
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
            stats {
                active90d
                birthdaysThisMonth
                earned30d
                expired30d
                members
                pointsOutstanding
                promosSent30d
                redeemed30d
                redemptions30d
                rewardValue30d
                spend30d
                tierCounts {
                    count
                    key
                    name
                }
            }
        }
    }
`

enum QueryLoyaltyBoard {
    Query1 = "query1",
}

const queryMap: Record<QueryLoyaltyBoard, DocumentNode> = {
    [QueryLoyaltyBoard.Query1]: query1,
}

/** Apollo params for {@link queryLoyaltyBoard}. */
type QueryLoyaltyBoardParams = QueryParams<QueryLoyaltyBoard>

/** The loyalty workbench board of the active workspace: programme, config, members, rewards, campaigns and figures. */
export const queryLoyaltyBoard = async ({ query = QueryLoyaltyBoard.Query1, signal }: QueryLoyaltyBoardParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query<LoyaltyBoardQuery>({ query: queryMap[query] })
}
