import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { QueryWorkItemsRequest, QueryWorkItemsResponse } from "./types/work-items"

const query1 = gql`
    query WorkItems($input: ListWorkItemsInput!) {
        workItems(input: $input) {
            items { action assigned_staff_id created_at id proposal { amount_vnd draft fields summary } reason status }
            next { createdAt id }
        }
    }
`

export enum QueryWorkItems {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkItems, DocumentNode> = {
    [QueryWorkItems.Query1]: query1,
}

/** Apollo params for {@link queryWorkItems}. */
export type QueryWorkItemsParams = QueryParams<QueryWorkItems, QueryWorkItemsRequest> & { request: QueryWorkItemsRequest }

/** The work items of the active workspace, filtered by status (the loyalty pending tab asks for waiting_decision). */
export const queryWorkItems = async ({ query = QueryWorkItems.Query1, request, signal }: QueryWorkItemsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query<QueryWorkItemsResponse, InputVariables<QueryWorkItemsRequest>>({
        query: queryMap[query],
        variables: { input: request },
    })
}
