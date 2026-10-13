import type { ListWorkspacesRequest, ListWorkspacesResult } from "../../application/list-workspaces.contracts"
import type { ListWorkspacesRequest as ListWorkspacesHttpRequest } from "./dto/list-workspaces.request"
import type { ListWorkspacesResponse } from "./dto/list-workspaces.response"

/** Maps the HTTP request to the application request. */
export const toListWorkspacesRequest = (input: ListWorkspacesHttpRequest): ListWorkspacesRequest => ({
    filter: input.filter,
    query: input.query,
})

/** Maps the application result to the HTTP response. */
export const toListWorkspacesResponse = (result: ListWorkspacesResult): ListWorkspacesResponse => result
