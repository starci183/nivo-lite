import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { BrainDossiersQuery } from "../__generated__/graphql"

type QueryBrainDossiersResponse = BrainDossiersQuery

const query1: TypedDocumentNode<QueryBrainDossiersResponse> = gql`
    query BrainDossiers {
        brainDossiers {
            id
            ref
            category
            categoryOrder
            position
            name
            status
            existing
            missing
            drafts
            documentCount
        }
    }
`

enum QueryBrainDossiers {
    Query1 = "query1",
}
const queryMap: Record<QueryBrainDossiers, typeof query1> = { [QueryBrainDossiers.Query1]: query1 }

/** Calls the backend brainDossiers query: the dossiers the active workspace tracks, with their status and the documents that name each. */
export const queryBrainDossiers = async ({
    query = QueryBrainDossiers.Query1,
    signal,
}: QueryParams<QueryBrainDossiers> = {}): Promise<ApolloClient.QueryResult<QueryBrainDossiersResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
