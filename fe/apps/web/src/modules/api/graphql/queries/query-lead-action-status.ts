import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { LeadActionStatusQuery, LeadActionStatusQueryVariables } from "../__generated__/graphql"

/** Generated input of the leadActionStatus query. */
type QueryLeadActionStatusRequest = WireInput<LeadActionStatusQueryVariables["input"]>

/** Generated response of the leadActionStatus query. */
type QueryLeadActionStatusResponse = LeadActionStatusQuery

type Document = TypedDocumentNode<QueryLeadActionStatusResponse, InputVariables<QueryLeadActionStatusRequest>>

const query1: Document = gql`
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

const queryMap: Record<QueryLeadActionStatus, Document> = {
    [QueryLeadActionStatus.Query1]: query1,
}

/** Apollo parameters for the leadActionStatus query. */
type QueryLeadActionStatusParams = QueryParams<QueryLeadActionStatus, QueryLeadActionStatusRequest> & {
    request: QueryLeadActionStatusRequest
}

/** Runs the workspace-scoped leadActionStatus query through the authenticated GraphQL client. */
export const queryLeadActionStatus = async ({
    query = QueryLeadActionStatus.Query1,
    request,
    signal,
    headers,
}: QueryLeadActionStatusParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
