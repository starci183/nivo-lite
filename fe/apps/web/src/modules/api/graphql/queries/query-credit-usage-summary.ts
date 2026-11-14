import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { CreditUsageSummaryQuery } from "../__generated__/graphql"

type QueryCreditUsageSummaryResponse = CreditUsageSummaryQuery

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
}: QueryParams<QueryCreditUsageSummary> = {}): Promise<ApolloClient.QueryResult<QueryCreditUsageSummaryResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
