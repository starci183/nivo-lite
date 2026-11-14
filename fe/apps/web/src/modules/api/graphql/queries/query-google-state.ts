import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { GoogleConnectionStateQuery } from "../__generated__/graphql"

/** The response of the `googleConnectionState` query: the typed payload straight from the back end contract. */
type QueryGoogleStateResponse = GoogleConnectionStateQuery

const query1: TypedDocumentNode<QueryGoogleStateResponse> = gql`
    query GoogleConnectionState {
        googleConnectionState {
            configured
            consentNeeded
            ledger {
                state
                email
                sheetId
                sheetUrl
                sheetTitle
                lastRowAt
            }
        }
    }
`

enum QueryGoogleState {
    Query1 = "query1",
}

const queryMap: Record<QueryGoogleState, TypedDocumentNode<QueryGoogleStateResponse>> = {
    [QueryGoogleState.Query1]: query1,
}

/** Apollo params for {@link queryGoogleState}. */
type QueryGoogleStateParams = QueryParams<QueryGoogleState>

/**
 * Whether Google is set up on this deployment, whether a Google connection made for the workspace still waits for the owner to
 * consent once, and where the ledger kept in a Google spreadsheet stands (the back end `googleConnectionState` query). Rejects with the
 * back end failure.
 */
export const queryGoogleState = async ({
    query = QueryGoogleState.Query1,
    signal,
}: QueryGoogleStateParams = {}): Promise<ApolloClient.QueryResult<QueryGoogleStateResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
