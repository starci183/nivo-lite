import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { PublicHiringInterviewQuery, PublicHiringInterviewQueryVariables } from "../__generated__/graphql"

/** The input of the `publicHiringInterview` query. */
export type QueryPublicHiringInterviewRequest = WireInput<PublicHiringInterviewQueryVariables["input"]>

/** The response of the `publicHiringInterview` query. */
type QueryPublicHiringInterviewResponse = PublicHiringInterviewQuery

const query1: TypedDocumentNode<
    QueryPublicHiringInterviewResponse,
    InputVariables<QueryPublicHiringInterviewRequest>
> = gql`
    query PublicHiringInterview($input: HiringTokenInput!) {
        publicHiringInterview(input: $input) {
            candidateName
            durationMin
            interviewerName
            jobTitle
            location
            mode
            note
            proposedSlots {
                end
                start
            }
            shop
            slotStart
            status
        }
    }
`

enum QueryPublicHiringInterview {
    Query1 = "query1",
}

const queryMap: Record<
    QueryPublicHiringInterview,
    TypedDocumentNode<QueryPublicHiringInterviewResponse, InputVariables<QueryPublicHiringInterviewRequest>>
> = {
    [QueryPublicHiringInterview.Query1]: query1,
}

/** Apollo params for {@link queryPublicHiringInterview}. */
type QueryPublicHiringInterviewParams = QueryParams<QueryPublicHiringInterview, QueryPublicHiringInterviewRequest> & {
    request: QueryPublicHiringInterviewRequest
}

/** Runs the `publicHiringInterview` query (anonymous public door). */
export const queryPublicHiringInterview = async ({
    query = QueryPublicHiringInterview.Query1,
    request,
    signal,
}: QueryPublicHiringInterviewParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
