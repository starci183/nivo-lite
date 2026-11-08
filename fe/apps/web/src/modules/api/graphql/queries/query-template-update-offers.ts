import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { TemplateUpdateOffersQuery } from "../__generated__/graphql"

type QueryTemplateUpdateOffersResponse = TemplateUpdateOffersQuery

const query1: TypedDocumentNode<QueryTemplateUpdateOffersResponse> = gql`
    query TemplateUpdateOffers {
        templateUpdateOffers {
            installationId
            key
            installed
            offered
            breaking
            changelog
            units {
                id
                nodeKey
                branchKey
                change
            }
        }
    }
`

enum QueryTemplateUpdateOffers {
    Query1 = "query1",
}
const queryMap: Record<QueryTemplateUpdateOffers, typeof query1> = { [QueryTemplateUpdateOffers.Query1]: query1 }

/** Calls the backend templateUpdateOffers query. */
export const queryTemplateUpdateOffers = async ({
    query = QueryTemplateUpdateOffers.Query1,
    signal,
}: QueryParams<QueryTemplateUpdateOffers> = {}): Promise<
    ApolloClient.QueryResult<QueryTemplateUpdateOffersResponse>
> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
