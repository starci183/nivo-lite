import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ResponsibilitiesQuery } from "../__generated__/graphql"

type QueryResponsibilitiesResponse = ResponsibilitiesQuery

const query1: TypedDocumentNode<QueryResponsibilitiesResponse, Record<string, never>> = gql`
    query Responsibilities {
        responsibilities {
            contact_name
            created_at
            due_at
            id
            lead_id
            next_action
            owner_agent_id
            owner_kind
            owner_name
            status
            title
            workspace_id
        }
    }
`

enum QueryResponsibilities {
    Query1 = "query1",
}

const queryMap: Record<
    QueryResponsibilities,
    TypedDocumentNode<QueryResponsibilitiesResponse, Record<string, never>>
> = {
    [QueryResponsibilities.Query1]: query1,
}

type QueryResponsibilitiesParams = QueryParams<QueryResponsibilities>

/** The back end `responsibilities` query. Rejects with the back end failure (message localized by the server). */
export const queryResponsibilities = async ({
    query = QueryResponsibilities.Query1,
    signal,
}: QueryResponsibilitiesParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
