import type { PageRequest } from "@modules/platform/pagination"

/** Selects a page of the workspace's newest sales orders. */
export interface ListSalesOrdersRequest extends PageRequest {
    /** The selected workspace, proved by the handler. */
    readonly workspaceId: string
}
