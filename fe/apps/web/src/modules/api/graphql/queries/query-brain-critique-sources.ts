import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { BrainCritiqueSourcesQuery } from "../__generated__/graphql"

type Document = TypedDocumentNode<BrainCritiqueSourcesQuery>

const query1: Document = gql`
    query BrainCritiqueSources {
        brainCritiqueSources {
            sourceId
            title
            open
            high
            review {
                attempts
                finishedAt
                reason
                released
                releasedAt
                state
                waitingPassages
            }
        }
    }
`

enum QueryBrainCritiqueSourcesDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryBrainCritiqueSourcesDocument, Document> = {
    [QueryBrainCritiqueSourcesDocument.Query1]: query1,
}

/** Every document the critic has a view of, with its open and high point counts and review state. Rejects with the back end failure. */
export const queryBrainCritiqueSources = async ({
    query = QueryBrainCritiqueSourcesDocument.Query1,
    signal,
}: QueryParams<QueryBrainCritiqueSourcesDocument> = {}): Promise<ApolloClient.QueryResult<BrainCritiqueSourcesQuery>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
