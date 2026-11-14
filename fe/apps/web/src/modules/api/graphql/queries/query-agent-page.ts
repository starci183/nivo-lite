import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentPageQuery, AgentPageQueryVariables } from "../__generated__/graphql"

/** The input of the `agentPage` query. */
export type QueryAgentPageRequest = WireInput<AgentPageQueryVariables["input"]>

type QueryAgentPageResponse = AgentPageQuery

const query1: TypedDocumentNode<QueryAgentPageResponse, InputVariables<QueryAgentPageRequest>> = gql`
    query AgentPage($input: AgentIdInput!) {
        agentPage(input: $input) {
            agent {
                avatarUrl
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
export const queryAgentPage = async ({
    query = QueryAgentPage.Query1,
    request,
    signal,
}: QueryAgentPageParams): Promise<ApolloClient.QueryResult<QueryAgentPageResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
