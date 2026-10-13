import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { HiringCandidateDetailQuery, HiringCandidateDetailQueryVariables } from "../__generated__/graphql"

/** The input of the `hiringCandidateDetail` query. */
export type QueryHiringCandidateDetailRequest = WireInput<HiringCandidateDetailQueryVariables["input"]>

/** The response of the `hiringCandidateDetail` query. */
type QueryHiringCandidateDetailResponse = HiringCandidateDetailQuery

const query1: TypedDocumentNode<
    QueryHiringCandidateDetailResponse,
    InputVariables<QueryHiringCandidateDetailRequest>
> = gql`
    query HiringCandidateDetail($input: HiringCandidateRefInput!) {
        hiringCandidateDetail(input: $input) {
            cv {
                mime
                name
                url
            }
            events {
                actor
                createdAt
                id
                kind
                summary
            }
        }
    }
`

enum QueryHiringCandidateDetail {
    Query1 = "query1",
}

const queryMap: Record<
    QueryHiringCandidateDetail,
    TypedDocumentNode<QueryHiringCandidateDetailResponse, InputVariables<QueryHiringCandidateDetailRequest>>
> = {
    [QueryHiringCandidateDetail.Query1]: query1,
}

/** Apollo params for {@link queryHiringCandidateDetail}. */
type QueryHiringCandidateDetailParams = QueryParams<QueryHiringCandidateDetail, QueryHiringCandidateDetailRequest> & {
    request: QueryHiringCandidateDetailRequest
}

/** Runs the `hiringCandidateDetail` query. */
export const queryHiringCandidateDetail = async ({
    query = QueryHiringCandidateDetail.Query1,
    request,
    signal,
}: QueryHiringCandidateDetailParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
