import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentPageQuery, AgentPageQueryVariables } from "../__generated__/graphql"

/** The input of the `agentPage` query. */
export type QueryAgentPageRequest = WireInput<AgentPageQueryVariables["input"]>

type QueryAgentPageResponse = AgentPageQuery

const query1: TypedDocumentNode<QueryAgentPageResponse, InputVariables<QueryAgentPageRequest>> = gql`
    query AgentPage($input: AgentIdInput!) {
        agentPage(input: $input) {
            agent {
                handle
                id
                module
                name
                operatingMode
                role
                roomName
                status
            }
            ownership {
                agentId
                assignableRoles
                assignableRooms {
                    key
                    name
                }
                canTag {
                    id
                    module
                    name
                    status
                }
                fallback {
                    active
                    memberId
                    name
                    role
                    roomId
                }
                owner {
                    active
                    memberId
                    name
                    role
                    roomId
                }
                responder {
                    fallbackMemberId
                    ownerMemberId
                }
            }
            recent {
                data {
                    action
                    at
                    customer
                    id
                    leadId
                    status
                    title
                }
                ok
            }
            rules {
                data {
                    action
                    department
                    limitVnd
                    mode
                    note
                }
                ok
            }
        }
    }
`

enum QueryAgentPage {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentPage,
    TypedDocumentNode<QueryAgentPageResponse, InputVariables<QueryAgentPageRequest>>
> = {
    [QueryAgentPage.Query1]: query1,
}

type QueryAgentPageParams = QueryParams<QueryAgentPage, QueryAgentPageRequest> & {
    request: QueryAgentPageRequest
}

/** The back end `agentPage` query. Rejects with the back end failure (message localized by the server). */
export const queryAgentPage = async ({ query = QueryAgentPage.Query1, request, signal }: QueryAgentPageParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
