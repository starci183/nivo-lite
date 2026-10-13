import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryVideoRenderStatusArgs } from "../__generated__/schema"

/** The input of the `videoRenderStatus` query. */
type QueryVideoRenderStatusRequest = QueryVideoRenderStatusArgs["input"]

/** The generated payload of the `videoRenderStatus` query. */
type QueryVideoRenderStatusResponse = Pick<Query, "videoRenderStatus">

type Document = TypedDocumentNode<QueryVideoRenderStatusResponse, InputVariables<QueryVideoRenderStatusRequest>>

const query1: Document = gql`
    query VideoRenderStatus($input: VideoRenderStatusInput!) {
        videoRenderStatus(input: $input) {
            durationMs
            errorCode
            id
            outputPath
            posterPath
            progress
            sizeBytes
            stage
            status
        }
    }
`

enum QueryVideoRenderStatus {
    Query1 = "query1",
}

const queryMap: Record<QueryVideoRenderStatus, Document> = {
    [QueryVideoRenderStatus.Query1]: query1,
}

/** Apollo options for the `videoRenderStatus` query. */
type QueryVideoRenderStatusParams = QueryParams<QueryVideoRenderStatus, QueryVideoRenderStatusRequest> & {
    request: QueryVideoRenderStatusRequest
}

/** Reads `videoRenderStatus` through the authenticated back end GraphQL API. */
export const queryVideoRenderStatus = async ({
    query = QueryVideoRenderStatus.Query1,
    request,
    signal,
}: QueryVideoRenderStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
