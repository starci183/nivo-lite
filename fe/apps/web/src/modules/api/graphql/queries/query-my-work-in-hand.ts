import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
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
    createAuthApolloClient({ signal: params.signal, headers: params.headers }).query({ query: query1 })
