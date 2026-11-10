import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type {
    ProviderTemplateCandidatesQuery,
    ProviderTemplateCandidatesQueryVariables,
} from "../__generated__/graphql"

/** Generated input of the providerTemplateCandidates query. */
type QueryProviderTemplateCandidatesRequest = WireInput<ProviderTemplateCandidatesQueryVariables["input"]>

/** Generated response of the providerTemplateCandidates query. */
type QueryProviderTemplateCandidatesResponse = ProviderTemplateCandidatesQuery

type Document = TypedDocumentNode<
    QueryProviderTemplateCandidatesResponse,
    InputVariables<QueryProviderTemplateCandidatesRequest>
>

const query1: Document = gql`
    query ProviderTemplateCandidates($input: ProviderTemplateCandidatesInput!) {
        providerTemplateCandidates(input: $input) {
            agentId
            agentName
            module
            abilities {
                id
                mode
            }
        }
    }
`

enum QueryProviderTemplateCandidatesDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryProviderTemplateCandidatesDocument, Document> = {
    [QueryProviderTemplateCandidatesDocument.Query1]: query1,
}

type QueryProviderTemplateCandidatesParams = QueryParams<
    QueryProviderTemplateCandidatesDocument,
    QueryProviderTemplateCandidatesRequest
> & { request: QueryProviderTemplateCandidatesRequest }

/** The agents that could get one connected account by their template. Rejects with the back end failure. */
export const queryProviderTemplateCandidates = async ({
    query = QueryProviderTemplateCandidatesDocument.Query1,
    request,
    signal,
}: QueryProviderTemplateCandidatesParams): Promise<
    ApolloClient.QueryResult<QueryProviderTemplateCandidatesResponse>
> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
