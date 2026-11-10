import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { LeadFreezeQuery, LeadFreezeQueryVariables } from "../__generated__/graphql"

/** Generated input of the leadFreeze query. */
export type QueryLeadFreezeRequest = WireInput<LeadFreezeQueryVariables["input"]>

/** Generated response of the leadFreeze query. */
type QueryLeadFreezeResponse = LeadFreezeQuery

type Document = TypedDocumentNode<QueryLeadFreezeResponse, InputVariables<QueryLeadFreezeRequest>>

const query1: Document = gql`
    query LeadFreeze($input: LeadFreezeInput!) {
        leadFreeze(input: $input) {
            id
            status
            workflowId
            leadId
            runId
            stepTitle
            reason
            workItemId
            pendingCount
            heldBy
        }
    }
`

enum QueryLeadFreeze {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadFreeze, Document> = {
    [QueryLeadFreeze.Query1]: query1,
}

type QueryLeadFreezeParams = QueryParams<QueryLeadFreeze, QueryLeadFreezeRequest> & {
    request: QueryLeadFreezeRequest
}

/** The back end `leadFreeze` query: whether a lead, or the customer of a run, waits for the owner to handle a failed run; null when not. */
export const queryLeadFreeze = async ({
    query = QueryLeadFreeze.Query1,
    request,
    signal,
}: QueryLeadFreezeParams): Promise<ApolloClient.QueryResult<QueryLeadFreezeResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
