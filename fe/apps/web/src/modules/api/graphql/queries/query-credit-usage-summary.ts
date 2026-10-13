import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryCreditUsageSummaryResponse = Pick<Query, "creditUsageSummary">

const query1: TypedDocumentNode<QueryCreditUsageSummaryResponse> = gql`
    query CreditUsageSummary {
        creditUsageSummary {
            status {
                periodStart
                messagesUsed
                tokensUsed
                costUsd
                messagesLimit
                tokensLimit
                fallbackReply
                creditsUsed
                creditsLimit
                creditsCarried
                topupBalance
                messagesExceeded
                tokensExceeded
                creditsExceeded
                ratio
                level
            }
            byModule {
                module
                calls
                tokens
                costUsd
                credits
            }
            daily {
                day
                tokens
                credits
            }
        }
    }
`

/** The available creditUsageSummary documents. */
enum QueryCreditUsageSummary {
    Query1 = "query1",
}

const queryMap: Record<QueryCreditUsageSummary, typeof query1> = { [QueryCreditUsageSummary.Query1]: query1 }

/** Reads creditUsageSummary through the authenticated GraphQL client. */
export const queryCreditUsageSummary = async ({
    query = QueryCreditUsageSummary.Query1,
    signal,
}: QueryParams<QueryCreditUsageSummary> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
