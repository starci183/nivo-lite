import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { MyAgentTemplatesQuery } from "../__generated__/graphql"

type QueryMyAgentTemplatesResponse = MyAgentTemplatesQuery

const query1: TypedDocumentNode<QueryMyAgentTemplatesResponse> = gql`
    query MyAgentTemplates {
        myAgentTemplates {
            id
            key
            baseModule
            name {
                vi
                en
            }
            versions {
                id
                key
                version
                hash
                changelog
                breaking
                createdAt
            }
        }
    }
`

enum QueryMyAgentTemplates {
    Query1 = "query1",
}
const queryMap: Record<QueryMyAgentTemplates, typeof query1> = { [QueryMyAgentTemplates.Query1]: query1 }

/** Calls the backend myAgentTemplates query. */
export const queryMyAgentTemplates = async ({
    query = QueryMyAgentTemplates.Query1,
    signal,
}: QueryParams<QueryMyAgentTemplates> = {}): Promise<ApolloClient.QueryResult<QueryMyAgentTemplatesResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query] })
}
