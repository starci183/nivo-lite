/** Selects an order within the caller's workspace. */
export interface GetSalesOrderRequest {
    /** The selected workspace, proved by the handler. */
    readonly workspaceId: string
    /** The order to read. */
    readonly id: string
}
