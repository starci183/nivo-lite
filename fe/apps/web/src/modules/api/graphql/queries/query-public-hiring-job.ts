import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { PublicHiringJobQuery, PublicHiringJobQueryVariables } from "../__generated__/graphql"

/** The input of the `publicHiringJob` query. */
export type QueryPublicHiringJobRequest = WireInput<PublicHiringJobQueryVariables["input"]>

/** The response of the `publicHiringJob` query. */
type QueryPublicHiringJobResponse = PublicHiringJobQuery

const query1: TypedDocumentNode<QueryPublicHiringJobResponse, InputVariables<QueryPublicHiringJobRequest>> = gql`
    query PublicHiringJob($input: PublicHiringJobInput!) {
        publicHiringJob(input: $input) {
            closesAt
            company
            consentText
            description
            employmentType
            headcount
            location
            open
            payMaxVnd
            payMinVnd
            payUnit
            position
            questions {
                choices
                id
                required
                text
                type
            }
            requirements {
                availability
                experienceNote
                experienceYears
                mustHave
                niceToHave
                skills
            }
            schedule
            status
            title
        }
    }
`

enum QueryPublicHiringJob {
    Query1 = "query1",
}

const queryMap: Record<
    QueryPublicHiringJob,
    TypedDocumentNode<QueryPublicHiringJobResponse, InputVariables<QueryPublicHiringJobRequest>>
> = {
    [QueryPublicHiringJob.Query1]: query1,
}

/** Apollo params for {@link queryPublicHiringJob}. */
type QueryPublicHiringJobParams = QueryParams<QueryPublicHiringJob, QueryPublicHiringJobRequest> & {
    request: QueryPublicHiringJobRequest
}

/** Runs the `publicHiringJob` query (anonymous public door). */
export const queryPublicHiringJob = async ({
    query = QueryPublicHiringJob.Query1,
    request,
    signal,
}: QueryPublicHiringJobParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
