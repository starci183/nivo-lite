import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { CreditQuotaStatusQuery } from "../__generated__/graphql"

type QueryCreditQuotaStatusResponse = CreditQuotaStatusQuery

const query1: TypedDocumentNode<QueryCreditQuotaStatusResponse> = gql`
    query CreditQuotaStatus {
        creditQuotaStatus {
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
    }
`

/** The available creditQuotaStatus documents. */
enum QueryCreditQuotaStatus {
    Query1 = "query1",
}

const queryMap: Record<QueryCreditQuotaStatus, typeof query1> = { [QueryCreditQuotaStatus.Query1]: query1 }

/** Reads creditQuotaStatus through the authenticated GraphQL client. */
export const queryCreditQuotaStatus = async ({
    query = QueryCreditQuotaStatus.Query1,
    signal,
}: QueryParams<QueryCreditQuotaStatus> = {}): Promise<ApolloClient.QueryResult<QueryCreditQuotaStatusResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
