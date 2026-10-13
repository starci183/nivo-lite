import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { InventoryTemplatesQuery } from "../__generated__/graphql"

/** The response of the `inventoryTemplates` query. */
type QueryInventoryTemplatesResponse = InventoryTemplatesQuery

const query1: TypedDocumentNode<QueryInventoryTemplatesResponse> = gql`
    query InventoryTemplates {
        inventoryTemplates {
            description
            key
            name
        }
    }
`

enum QueryInventoryTemplates {
    Query1 = "query1",
}

const queryMap: Record<QueryInventoryTemplates, TypedDocumentNode<QueryInventoryTemplatesResponse>> = {
    [QueryInventoryTemplates.Query1]: query1,
}

/** Apollo params for {@link queryInventoryTemplates}. */
type QueryInventoryTemplatesParams = QueryParams<QueryInventoryTemplates>

/** Runs the `inventoryTemplates` query. */
export const queryInventoryTemplates = async ({
    query = QueryInventoryTemplates.Query1,
    signal,
}: QueryInventoryTemplatesParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
