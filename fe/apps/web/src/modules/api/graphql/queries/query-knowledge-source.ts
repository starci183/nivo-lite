import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { KnowledgeSourceQuery, KnowledgeSourceQueryVariables } from "../__generated__/graphql"

/** The response of the `knowledgeSource` query: the typed payload straight from the back end contract. */
type QueryKnowledgeSourceResponse = KnowledgeSourceQuery

/** The input of the `knowledgeSource` query. */
type QueryKnowledgeSourceRequest = WireInput<KnowledgeSourceQueryVariables["input"]>

const query1: TypedDocumentNode<QueryKnowledgeSourceResponse, InputVariables<QueryKnowledgeSourceRequest>> = gql`
    query KnowledgeSource($input: KnowledgeSourceInput!) {
        knowledgeSource(input: $input) {
            source {
                chunkCount
                content
                createdAt
                error
                id
                installationId
                kind
                module
                origin
                partCount
                progress
                sizeBytes
                stage
                stageDone
                stageTotal
                status
                tags
                title
                topic
                updatedAt
                visibility
                workspaceId
            }
            chunks {
                content
                hasEmbedding
                id
                order
            }
        }
    }
`

enum QueryKnowledgeSource {
    Query1 = "query1",
}

const queryMap: Record<
    QueryKnowledgeSource,
    TypedDocumentNode<QueryKnowledgeSourceResponse, InputVariables<QueryKnowledgeSourceRequest>>
> = {
    [QueryKnowledgeSource.Query1]: query1,
}

/** Apollo params for {@link queryKnowledgeSource}. */
interface QueryKnowledgeSourceParams extends QueryParams<QueryKnowledgeSource, QueryKnowledgeSourceRequest> {
    request: QueryKnowledgeSourceRequest
}

/**
 * Reads one document of the workspace with its text and stored passages (the back end `knowledgeSource` query). Rejects
 * with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const queryKnowledgeSource = async ({
    query = QueryKnowledgeSource.Query1,
    request,
    signal,
}: QueryKnowledgeSourceParams): Promise<ApolloClient.QueryResult<QueryKnowledgeSourceResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
