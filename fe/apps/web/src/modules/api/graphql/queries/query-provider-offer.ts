import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ProviderOfferQuery, ProviderOfferQueryVariables } from "../__generated__/graphql"

/** Generated input of the providerOffer query. */
type QueryProviderOfferRequest = WireInput<ProviderOfferQueryVariables["input"]>

/** Generated response of the providerOffer query. */
type QueryProviderOfferResponse = ProviderOfferQuery

type Document = TypedDocumentNode<QueryProviderOfferResponse, InputVariables<QueryProviderOfferRequest>>

const query1: Document = gql`
    query ProviderOffer($input: GetProviderOfferInput!) {
        providerOffer(input: $input) {
            connectionId
            provider
            api {
                name
                kind
                shape
                freshness
                summary {
                    ...ProviderOfferWordsFields
                }
                parameters {
                    ...ProviderOfferMemberFields
                }
                returns {
                    ...ProviderOfferMemberFields
                }
            }
            mcp {
                id
                kind
                effect
                description
                title {
                    ...ProviderOfferWordsFields
                }
                summary {
                    ...ProviderOfferWordsFields
                }
                operation {
                    method
                    path
                    state
                    unsupported
                }
                parameters {
                    ...ProviderOfferMemberFields
                }
                returns {
                    ...ProviderOfferMemberFields
                }
            }
            triggers {
                name
                kind
                decided
                recovery
                summary {
                    ...ProviderOfferWordsFields
                }
                batching {
                    mode
                    maxEvents
                }
                payload {
                    ...ProviderOfferMemberFields
                }
            }
        }
    }

    fragment ProviderOfferWordsFields on ProviderOfferWordsType {
        vi
        en
    }

    fragment ProviderOfferMemberFields on ProviderOfferMemberType {
        name
        type
        format
        required
        filterable
        choices
        description
        label {
            vi
            en
        }
    }
`

enum QueryProviderOfferDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryProviderOfferDocument, Document> = {
    [QueryProviderOfferDocument.Query1]: query1,
}

type QueryProviderOfferParams = QueryParams<QueryProviderOfferDocument, QueryProviderOfferRequest> & {
    request: QueryProviderOfferRequest
}

/**
 * The documentation of what one connected account's provider offers on its three levels (the reads screens call, the tools agents
 * call, the triggers that wake workflows), from the registries; no live call to the provider. Rejects with the back end failure.
 */
export const queryProviderOffer = async ({
    query = QueryProviderOfferDocument.Query1,
    request,
    signal,
}: QueryProviderOfferParams): Promise<ApolloClient.QueryResult<QueryProviderOfferResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
