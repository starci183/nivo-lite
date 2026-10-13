import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { QueryPublicLoyaltyPageRequest, QueryPublicLoyaltyPageResponse } from "./types/public-loyalty-page"

const query1 = gql`
    query PublicLoyaltyPage($input: PublicLoyaltyPageInput!) {
        publicLoyaltyPage(input: $input) {
            name shop slug
        }
    }
`

export enum QueryPublicLoyaltyPage {
    Query1 = "query1",
}

const queryMap: Record<QueryPublicLoyaltyPage, DocumentNode> = {
    [QueryPublicLoyaltyPage.Query1]: query1,
}

/** Apollo params for {@link queryPublicLoyaltyPage}. */
export type QueryPublicLoyaltyPageParams = QueryParams<QueryPublicLoyaltyPage, QueryPublicLoyaltyPageRequest> & { request: QueryPublicLoyaltyPageRequest }

/** The public loyalty page of one shop slug (anonymous). */
export const queryPublicLoyaltyPage = async ({ query = QueryPublicLoyaltyPage.Query1, request, signal }: QueryPublicLoyaltyPageParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.query<QueryPublicLoyaltyPageResponse, InputVariables<QueryPublicLoyaltyPageRequest>>({
        query: queryMap[query],
        variables: { input: request },
    })
}
