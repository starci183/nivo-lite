import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLessonMiningStatusArgs } from "../__generated__/schema"

/** The response of the `lessonMiningStatus` query: the typed payload straight from the back end contract. */
type QueryLessonMiningStatusResponse = Pick<Query, "lessonMiningStatus">

/** The input of the `lessonMiningStatus` query. */
type QueryLessonMiningStatusRequest = QueryLessonMiningStatusArgs["input"]

const query1: TypedDocumentNode<QueryLessonMiningStatusResponse, InputVariables<QueryLessonMiningStatusRequest>> = gql`
    query LessonMiningStatus($input: LessonMiningStatusInput!) {
        lessonMiningStatus(input: $input) {
            corrections
            errorCode
            id
            newCases
            proposed
            reason
            status
        }
    }
`

enum QueryLessonMiningStatus {
    Query1 = "query1",
}

const queryMap: Record<
    QueryLessonMiningStatus,
    TypedDocumentNode<QueryLessonMiningStatusResponse, InputVariables<QueryLessonMiningStatusRequest>>
> = {
    [QueryLessonMiningStatus.Query1]: query1,
}

/** Apollo params for {@link queryLessonMiningStatus}. */
interface QueryLessonMiningStatusParams extends QueryParams<QueryLessonMiningStatus, QueryLessonMiningStatusRequest> {
    request: QueryLessonMiningStatusRequest
}

/**
 * Reads where the study of an agent's corrections stands (the back end `lessonMiningStatus` query). Rejects with the back
 * end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const queryLessonMiningStatus = async ({
    query = QueryLessonMiningStatus.Query1,
    request,
    signal,
}: QueryLessonMiningStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
