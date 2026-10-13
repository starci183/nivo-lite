import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryDecisionHistoryArgs } from "../__generated__/schema"

/** The input of the `decisionHistory` query. */
export type QueryDecisionHistoryRequest = QueryDecisionHistoryArgs["input"]

type QueryDecisionHistoryResponse = Pick<Query, "decisionHistory">

const query1: TypedDocumentNode<QueryDecisionHistoryResponse, InputVariables<QueryDecisionHistoryRequest>> = gql`
    query DecisionHistory($input: ListDecisionHistoryInput!) {
        decisionHistory(input: $input) {
            action
            created_at
            decided_by
            decider_kind
            department
            id
            leadName
            lead_id
            note
            outcome
            reason
            work_item_id
        }
    }
`

enum QueryDecisionHistory {
    Query1 = "query1",
}

const queryMap: Record<
    QueryDecisionHistory,
    TypedDocumentNode<QueryDecisionHistoryResponse, InputVariables<QueryDecisionHistoryRequest>>
> = {
    [QueryDecisionHistory.Query1]: query1,
}

type QueryDecisionHistoryParams = QueryParams<QueryDecisionHistory, QueryDecisionHistoryRequest> & {
    request: QueryDecisionHistoryRequest
}

/** The back end `decisionHistory` query. Rejects with the back end failure (message localized by the server). */
export const queryDecisionHistory = async ({
    query = QueryDecisionHistory.Query1,
    request,
    signal,
}: QueryDecisionHistoryParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
