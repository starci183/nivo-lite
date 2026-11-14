/** Where the owner opens an order: the work desk of the sales agent, relative to the workspace. */
export const ORDER_HREF = "/agents/sales/workbench"

/** Where the owner opens one work item: the sales work desk focused on it, relative to the workspace. */
export const workItemHrefOf = (workItemId: string): string => `${ORDER_HREF}?focus=${encodeURIComponent(workItemId)}`
