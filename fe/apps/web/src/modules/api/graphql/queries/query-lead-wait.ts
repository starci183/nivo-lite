import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLeadWaitArgs } from "../__generated__/schema"

/** Generated input of the leadWait query. */
type QueryLeadWaitRequest = QueryLeadWaitArgs["input"]

/** Generated response of the leadWait query. */
type QueryLeadWaitResponse = Pick<Query, "leadWait">

type Document = TypedDocumentNode<QueryLeadWaitResponse, InputVariables<QueryLeadWaitRequest>>

const query1: Document = gql`
    query LeadWait($input: LeadWaitInput!) {
        leadWait(input: $input) {
            hours
            replied
            show
        }
    }
`

enum QueryLeadWait {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadWait, Document> = {
    [QueryLeadWait.Query1]: query1,
}

/** Apollo parameters for the leadWait query. */
type QueryLeadWaitParams = QueryParams<QueryLeadWait, QueryLeadWaitRequest> & { request: QueryLeadWaitRequest }

/** Runs the workspace-scoped leadWait query through the authenticated GraphQL client. */
export const queryLeadWait = async ({
    query = QueryLeadWait.Query1,
    request,
    signal,
    headers,
}: QueryLeadWaitParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
