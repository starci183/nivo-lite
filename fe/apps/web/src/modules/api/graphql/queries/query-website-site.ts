import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { WebsiteSiteQuery } from "../__generated__/graphql"

/** Generated selection returned by the website intake. */
type QueryWebsiteSiteResponse = WebsiteSiteQuery

type Document = TypedDocumentNode<QueryWebsiteSiteResponse, Record<string, never>>

const query1: Document = gql`
    query WebsiteSite {
        websiteSite {
            siteKey
            isEnabled
            chatEnabled
            formEnabled
            pricesEnabled
            agentId
            formUrl
        }
    }
`

enum QueryWebsiteSite {
    Query1 = "query1",
}

const queryMap: Record<QueryWebsiteSite, Document> = {
    [QueryWebsiteSite.Query1]: query1,
}

/** Apollo parameters for the website intake. */
type QueryWebsiteSiteParams = QueryParams<QueryWebsiteSite, Record<string, never>>

/** Reads the website intake of the workspace the Apollo context link selects; the first read issues its key. */
export const queryWebsiteSite = ({
    query = QueryWebsiteSite.Query1,
    signal,
    headers,
}: QueryWebsiteSiteParams = {}): Promise<ApolloClient.QueryResult<QueryWebsiteSiteResponse>> =>
    createAuthApolloClient({ signal, headers }).query({
        query: queryMap[query],
        context: { headers },
    })
