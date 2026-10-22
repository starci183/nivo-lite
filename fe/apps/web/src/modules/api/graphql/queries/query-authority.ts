import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { AuthorityQuery } from "../__generated__/graphql"

type QueryAuthorityResponse = AuthorityQuery

const query1: TypedDocumentNode<QueryAuthorityResponse, Record<string, never>> = gql`
    query Authority {
        authority {
            profile {
                brand_voice
                goal_first_reply_minutes
                goal_new_customers
                goal_note
                goal_revenue_vnd
                limits_note
                policies
                reply_style
                updated_at
                updated_by
            }
            rules {
                action
                agents
                approval_policy
                approver_members
                approver_roles
                approver_rooms
                ask_max
                auto_max
                department
                id
                limit_vnd
                mode
                note
                required_fields
                timeout_minutes
                unit
                updated_at
                workspace_id
            }
        }
    }
`

enum QueryAuthority {
    Query1 = "query1",
}

const queryMap: Record<QueryAuthority, TypedDocumentNode<QueryAuthorityResponse, Record<string, never>>> = {
    [QueryAuthority.Query1]: query1,
}

type QueryAuthorityParams = QueryParams<QueryAuthority>

/** The back end `authority` query. Rejects with the back end failure (message localized by the server). */
export const queryAuthority = async ({ query = QueryAuthority.Query1, signal }: QueryAuthorityParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
