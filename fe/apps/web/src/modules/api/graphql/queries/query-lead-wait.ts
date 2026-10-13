import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLeadWaitArgs } from "../__generated__/schema"

/** The generated lead identifier accepted by the wait query. */
type QueryLeadWaitRequest = QueryLeadWaitArgs["input"]

/** The generated website-lead response delay query response. */
type QueryLeadWaitResponse = Pick<Query, "leadWait">

type Document = TypedDocumentNode<QueryLeadWaitResponse, InputVariables<QueryLeadWaitRequest>>

const query1: Document = gql`
    query LeadWait($input: LeadWaitInput!) {
        leadWait(input: $input) {
            show
            hours
            replied
        }
    }
`

enum QueryLeadWait {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadWait, Document> = { [QueryLeadWait.Query1]: query1 }

/** Apollo params for {@link queryLeadWait}. */
type QueryLeadWaitParams = QueryParams<QueryLeadWait, QueryLeadWaitRequest> & { request: QueryLeadWaitRequest }

/** Reads factual response delay for a lead in the selected workspace. */
export const queryLeadWait = async ({ query = QueryLeadWait.Query1, request, signal }: QueryLeadWaitParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
