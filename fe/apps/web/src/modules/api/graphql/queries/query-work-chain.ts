import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { WorkChainQuery, WorkChainQueryVariables } from "../__generated__/graphql"

/** The input of the `workChain` query. */
export type QueryWorkChainRequest = WireInput<WorkChainQueryVariables["input"]>

type QueryWorkChainResponse = WorkChainQuery

const query1: TypedDocumentNode<QueryWorkChainResponse, InputVariables<QueryWorkChainRequest>> = gql`
    query WorkChain($input: WorkThreadIdInput!) {
        workChain(input: $input) {
            steps {
                id
                seq
                actorKind
                actorId
                actorName
                actorRole
                kind
                action
                detail
                rule
                target {
                    kind
                    id
                }
                approvalRequestId
                status
                decidedBy
                startedAt
                finishedAt
            }
            summary {
                steps
                humanDecisions
                minutes
                state
            }
        }
    }
`

enum QueryWorkChain {
    Query1 = "query1",
}

const queryMap: Record<
    QueryWorkChain,
    TypedDocumentNode<QueryWorkChainResponse, InputVariables<QueryWorkChainRequest>>
> = {
    [QueryWorkChain.Query1]: query1,
}

type QueryWorkChainParams = QueryParams<QueryWorkChain, QueryWorkChainRequest> & { request: QueryWorkChainRequest }

/** The back end `workChain` query: the steps of a thread's chain and the summary line. Rejects with the back end failure (message localized by the server). */
export const queryWorkChain = async ({ query = QueryWorkChain.Query1, request, signal }: QueryWorkChainParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
