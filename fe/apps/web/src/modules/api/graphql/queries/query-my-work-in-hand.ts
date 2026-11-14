import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { MyWorkInHandQuery } from "../__generated__/graphql"

/** The response of the `myWorkInHand` query: the typed payload straight from the back end contract. */
type QueryMyWorkInHandResponse = MyWorkInHandQuery

const query1: TypedDocumentNode<QueryMyWorkInHandResponse> = gql`
    query MyWorkInHand {
        myWorkInHand
    }
`

/** Apollo params for {@link queryMyWorkInHand}: the workspace travels as the `X-Workspace-Id` header. */
type QueryMyWorkInHandParams = Omit<QueryParams<never>, "query" | "request">

/** How many open work items are assigned to the signed-in person in a workspace (the back end `myWorkInHand` query). */
export const queryMyWorkInHand = (
    params: QueryMyWorkInHandParams,
): Promise<ApolloClient.QueryResult<QueryMyWorkInHandResponse>> =>
    createAuthApolloClient(webApiTransport, { signal: params.signal, headers: params.headers }).query({ query: query1 })
