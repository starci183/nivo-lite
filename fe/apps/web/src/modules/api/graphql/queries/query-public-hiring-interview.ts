import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryPublicHiringInterviewArgs } from "../__generated__/schema"

/** The input of the `publicHiringInterview` query. */
export type QueryPublicHiringInterviewRequest = QueryPublicHiringInterviewArgs["input"]

/** The response of the `publicHiringInterview` query. */
type QueryPublicHiringInterviewResponse = Pick<Query, "publicHiringInterview">

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
