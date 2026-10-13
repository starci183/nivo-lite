import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLeadActionStatusArgs } from "../__generated__/schema"

/** The input of the `leadActionStatus` query. */
export type QueryLeadActionStatusRequest = QueryLeadActionStatusArgs["input"]

type QueryLeadActionStatusResponse = Pick<Query, "leadActionStatus">

const query1: TypedDocumentNode<QueryLeadActionStatusResponse, InputVariables<QueryLeadActionStatusRequest>> = gql`
    query LeadActionStatus($input: LeadActionStatusInput!) {
        leadActionStatus(input: $input) {
            errorCode
            id
            result {
                contextSummary
                executionId
                leadId
                responsibilityId
                workItemId
            }
            status
        }
    }
`

enum QueryLeadActionStatus {
    Query1 = "query1",
}

const queryMap: Record<
    QueryLeadActionStatus,
    TypedDocumentNode<QueryLeadActionStatusResponse, InputVariables<QueryLeadActionStatusRequest>>
> = {
    [QueryLeadActionStatus.Query1]: query1,
}

type QueryLeadActionStatusParams = QueryParams<QueryLeadActionStatus, QueryLeadActionStatusRequest> & {
    request: QueryLeadActionStatusRequest
}

/** The back end `leadActionStatus` query. Rejects with the back end failure (message localized by the server). */
export const queryLeadActionStatus = async ({
    query = QueryLeadActionStatus.Query1,
    request,
    signal,
}: QueryLeadActionStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
