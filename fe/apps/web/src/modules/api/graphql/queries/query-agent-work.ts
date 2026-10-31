import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentWorkQuery, AgentWorkQueryVariables } from "../__generated__/graphql"

/** The input of the `agentWork` query. */
export type QueryAgentWorkRequest = WireInput<AgentWorkQueryVariables["input"]>

type QueryAgentWorkResponse = AgentWorkQuery

const query1: TypedDocumentNode<QueryAgentWorkResponse, InputVariables<QueryAgentWorkRequest>> = gql`
    query AgentWork($input: AgentWorkInstanceInput!) {
        agentWork(input: $input) {
            state {
                agentId
                backgroundTurns
                breakerUntil
                failures
                lastTurnAt
                workEnabled
            }
            goals {
                detail
                dueAt
                id
                source
                status
                title
            }
            tasks {
                dedupeKey
                detail
                id
                nextActionAt
                status
                title
                waitingOn
                workItemId
            }
            triggers {
                atTime
                enabled
                eventName
                id
                kind
                lastFiredAt
                nextRunAt
                preset
                probeKey
                seedKey
                timeZone
            }
            turns {
                completionTokens
                cost
                durationMs
                id
                model
                promptTokens
                reason
                source
                status
                wakeStatus
                wokeAt
                workItemId
            }
            pendingWakes
        }
    }
`

enum QueryAgentWork {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentWork, TypedDocumentNode<QueryAgentWorkResponse, InputVariables<QueryAgentWorkRequest>>> = {
    [QueryAgentWork.Query1]: query1,
}

type QueryAgentWorkParams = QueryParams<QueryAgentWork, QueryAgentWorkRequest> & { request: QueryAgentWorkRequest }

/** The back end `agentWork` query. The work of one agent: its switch, goals, open tasks, triggers and the last turns. Rejects with the back end failure (message localized by the server). */
export const queryAgentWork = async ({ query = QueryAgentWork.Query1, request, signal }: QueryAgentWorkParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
