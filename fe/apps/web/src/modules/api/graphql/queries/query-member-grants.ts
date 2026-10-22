import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { MemberGrantsQuery, MemberGrantsQueryVariables } from "../__generated__/graphql"

/** The input of the `memberGrants` query. */
export type QueryMemberGrantsRequest = WireInput<MemberGrantsQueryVariables["input"]>

type QueryMemberGrantsResponse = MemberGrantsQuery

const query1: TypedDocumentNode<QueryMemberGrantsResponse, InputVariables<QueryMemberGrantsRequest>> = gql`
    query MemberGrants($input: MemberGrantsInput!) {
        memberGrants(input: $input) {
            action
            maxAmount
            memberId
            unit
        }
    }
`

enum QueryMemberGrants {
    Query1 = "query1",
}

const queryMap: Record<
    QueryMemberGrants,
    TypedDocumentNode<QueryMemberGrantsResponse, InputVariables<QueryMemberGrantsRequest>>
> = {
    [QueryMemberGrants.Query1]: query1,
}

type QueryMemberGrantsParams = QueryParams<QueryMemberGrants, QueryMemberGrantsRequest> & {
    request: QueryMemberGrantsRequest
}

/** The back end `memberGrants` query. Rejects with the back end failure (message localized by the server). */
export const queryMemberGrants = async ({
    query = QueryMemberGrants.Query1,
    request,
    signal,
}: QueryMemberGrantsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
