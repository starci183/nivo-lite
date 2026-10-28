import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { ZaloConnectionPageQuery, ZaloConnectionPageQueryVariables } from "../__generated__/graphql"

/** The variables of the `zaloConnectionPage` query. */
type QueryZaloConnectionPageRequest = WireInput<ZaloConnectionPageQueryVariables["input"]>

/** The response of the `zaloConnectionPage` query: the typed payload straight from the back end contract. */
type QueryZaloConnectionPageResponse = ZaloConnectionPageQuery

const query1: TypedDocumentNode<QueryZaloConnectionPageResponse, InputVariables<QueryZaloConnectionPageRequest>> = gql`
    query ZaloConnectionPage($input: GetZaloPageInput!) {
        zaloConnectionPage(input: $input) {
            id
            name
            status
            healthy
            oaId
            appId
            appSecretMask
            oaSecretMask
            callbackUrl
            webhookUrl
            token {
                state
                expiresAt
                expiredMinutesAgo
                canRefresh
            }
            checks {
                key
                state
                code
                at
                names
            }
            recipients {
                userId
                name
                lastMessageAt
            }
            sendBlock
            agentIds
        }
    }
`

enum QueryZaloConnectionPage {
    Query1 = "query1",
}

const queryMap: Record<
    QueryZaloConnectionPage,
    TypedDocumentNode<QueryZaloConnectionPageResponse, InputVariables<QueryZaloConnectionPageRequest>>
> = {
    [QueryZaloConnectionPage.Query1]: query1,
}

/** Apollo params for {@link queryZaloConnectionPage}. */
interface QueryZaloConnectionPageParams extends QueryParams<QueryZaloConnectionPage, QueryZaloConnectionPageRequest> {
    request: QueryZaloConnectionPageRequest
}

/** The page of a Zalo OA connection. Rejects with the back end failure. */
export const queryZaloConnectionPage = async ({
    query = QueryZaloConnectionPage.Query1,
    request,
    signal,
}: QueryZaloConnectionPageParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
