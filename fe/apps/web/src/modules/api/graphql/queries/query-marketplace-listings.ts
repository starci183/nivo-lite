import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { MarketplaceListingsQuery } from "../__generated__/graphql"

type QueryMarketplaceListingsResponse = MarketplaceListingsQuery

const query1: TypedDocumentNode<QueryMarketplaceListingsResponse> = gql`
    query MarketplaceListings {
        marketplaceListings {
            id
            templateKey
            version
            name {
                vi
                en
            }
            summary {
                vi
                en
            }
            points {
                vi
                en
            }
            category
            publisherName
            firstParty
            priceVnd
            parameters {
                key
                kind
                label {
                    vi
                    en
                }
                hint {
                    vi
                    en
                }
                min
                max
                required
                defaultValue
                options {
                    value
                    label {
                        vi
                        en
                    }
                }
            }
            requiredProviders
            requiredAuthorityActions
            personName
        }
    }
`

enum QueryMarketplaceListings {
    Query1 = "query1",
}
const queryMap: Record<QueryMarketplaceListings, typeof query1> = { [QueryMarketplaceListings.Query1]: query1 }

/** Calls the backend marketplaceListings query. */
export const queryMarketplaceListings = async ({
    query = QueryMarketplaceListings.Query1,
    signal,
}: QueryParams<QueryMarketplaceListings> = {}): Promise<ApolloClient.QueryResult<QueryMarketplaceListingsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query] })
}
