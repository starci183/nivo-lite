import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { ContentAiStatusQuery, ContentAiStatusQueryVariables } from "../__generated__/graphql"

/** Generated input of the content AI progress query. */
type QueryContentAiStatusRequest = WireInput<ContentAiStatusQueryVariables["input"]>

/** Generated response of the content AI progress query. */
type QueryContentAiStatusResponse = ContentAiStatusQuery

type Document = TypedDocumentNode<QueryContentAiStatusResponse, InputVariables<QueryContentAiStatusRequest>>

const query1: Document = gql`
    query ContentAiStatus($input: GetContentAiStatusInput!) {
        contentAiStatus(input: $input) {
            id
            status
            progress
            itemId
            planId
            resultId
            ideas
            seconds
            skippedPast
            errorCode
            warnings {
                channel
                warning {
                    kind
                    phrase
                    figure
                    length
                    max
                }
            }
        }
    }
`

enum QueryContentAiStatus {
    Query1 = "query1",
}

const queryMap: Record<QueryContentAiStatus, Document> = {
    [QueryContentAiStatus.Query1]: query1,
}

/** Apollo options for a workspace-scoped job status. */
type QueryContentAiStatusParams = QueryParams<QueryContentAiStatus, QueryContentAiStatusRequest> & {
    request: QueryContentAiStatusRequest
}

/** Reads progress and the durable result of queued content work. */
export const queryContentAiStatus = async ({
    query = QueryContentAiStatus.Query1,
    request,
    signal,
}: QueryContentAiStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        fetchPolicy: "network-only",
    })
}
