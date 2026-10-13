import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryVideoScriptStatusArgs } from "../__generated__/schema"

/** The input of the `videoScriptStatus` query. */
type QueryVideoScriptStatusRequest = QueryVideoScriptStatusArgs["input"]

/** The generated payload of the `videoScriptStatus` query. */
type QueryVideoScriptStatusResponse = Pick<Query, "videoScriptStatus">

type Document = TypedDocumentNode<QueryVideoScriptStatusResponse, InputVariables<QueryVideoScriptStatusRequest>>

const query1: Document = gql`
    query VideoScriptStatus($input: VideoScriptStatusInput!) {
        videoScriptStatus(input: $input) {
            errorCode
            id
            progress
            projectId
            resultId
            status
        }
    }
`

enum QueryVideoScriptStatus {
    Query1 = "query1",
}

const queryMap: Record<QueryVideoScriptStatus, Document> = {
    [QueryVideoScriptStatus.Query1]: query1,
}

/** Apollo options for the `videoScriptStatus` query. */
type QueryVideoScriptStatusParams = QueryParams<QueryVideoScriptStatus, QueryVideoScriptStatusRequest> & {
    request: QueryVideoScriptStatusRequest
}

/** Reads `videoScriptStatus` through the authenticated back end GraphQL API. */
export const queryVideoScriptStatus = async ({
    query = QueryVideoScriptStatus.Query1,
    request,
    signal,
}: QueryVideoScriptStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
