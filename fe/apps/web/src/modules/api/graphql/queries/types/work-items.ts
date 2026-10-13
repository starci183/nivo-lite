import type { Query, QueryWorkItemsArgs } from "../../__generated__/schema"

/** The input of the `workItems` query. */
export type QueryWorkItemsRequest = QueryWorkItemsArgs["input"]

/** The response of the `workItems` query. */
export type QueryWorkItemsResponse = Pick<Query, "workItems">
