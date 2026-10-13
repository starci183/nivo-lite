import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryWorkItemsArgs } from "../__generated__/schema"

/** The input of the `workItems` query. */
export type QueryWorkItemsRequest = QueryWorkItemsArgs["input"]

type QueryWorkItemsResponse = Pick<Query, "workItems">

const query1: TypedDocumentNode<QueryWorkItemsResponse, InputVariables<QueryWorkItemsRequest>> = gql`
    query WorkItems($input: ListWorkItemsInput!) {
        workItems(input: $input) {
            items {
                action
                assigned_staff_id
                chain_id
                completed_at
                created_at
                decided_path
                department
                depth
                error
                evidence_state
                execution_id
                id
                inbound_event_id
                installation_id
                lead_id
                missing_fields
                origin
                parent_id
                proposal {
                    amount_vnd
                    candidates {
                        amount_vnd
                        id
                        label
                    }
                    confidence
                    draft
                    fields
                    outcome
                    summary
                }
                reason
                reasons
                result {
                    href
                    summary
                }
                status
                subject_id
                subject_type
                updated_at
                workspace_id
            }
            next {
                createdAt
                id
            }
        }
    }
`

enum QueryWorkItems {
    Query1 = "query1",
}

const queryMap: Record<
    QueryWorkItems,
    TypedDocumentNode<QueryWorkItemsResponse, InputVariables<QueryWorkItemsRequest>>
> = {
    [QueryWorkItems.Query1]: query1,
}

type QueryWorkItemsParams = QueryParams<QueryWorkItems, QueryWorkItemsRequest> & { request: QueryWorkItemsRequest }

/** The back end `workItems` query. Rejects with the back end failure (message localized by the server). */
export const queryWorkItems = async ({ query = QueryWorkItems.Query1, request, signal }: QueryWorkItemsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
