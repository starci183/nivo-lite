import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryKnowledgeSourcesArgs } from "../__generated__/schema"

/** The response of the `knowledgeSources` query: the typed payload straight from the back end contract. */
type QueryKnowledgeSourcesResponse = Pick<Query, "knowledgeSources">

/** The input of the `knowledgeSources` query. */
export type QueryKnowledgeSourcesRequest = QueryKnowledgeSourcesArgs["input"]

const query1: TypedDocumentNode<QueryKnowledgeSourcesResponse, InputVariables<QueryKnowledgeSourcesRequest>> = gql`
    query KnowledgeSources($input: KnowledgeSourcesInput!) {
        knowledgeSources(input: $input) {
            chunkCount
            createdAt
            error
            id
            installationId
            kind
            module
            progress
            status
            tags
            title
            topic
            updatedAt
            visibility
            workspaceId
        }
    }
`

enum QueryKnowledgeSources {
    Query1 = "query1",
}

const queryMap: Record<
    QueryKnowledgeSources,
    TypedDocumentNode<QueryKnowledgeSourcesResponse, InputVariables<QueryKnowledgeSourcesRequest>>
> = {
    [QueryKnowledgeSources.Query1]: query1,
}

/** Apollo params for {@link queryKnowledgeSources}. */
interface QueryKnowledgeSourcesParams extends QueryParams<QueryKnowledgeSources, QueryKnowledgeSourcesRequest> {
    request: QueryKnowledgeSourcesRequest
}

/**
 * Lists the documents of the workspace, optionally filtered to one module (the back end `knowledgeSources` query). Rejects
 * with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const queryKnowledgeSources = async ({
    query = QueryKnowledgeSources.Query1,
    request,
    signal,
}: QueryKnowledgeSourcesParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
