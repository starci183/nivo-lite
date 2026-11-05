/** The permission to see leads and orders. */
export const SALES_VIEW = "sales.view"

/** The permission to move leads and to confirm or cancel orders. */
export const SALES_MANAGE = "sales.manage"

/** The owner's right: confirming an order at the threshold or above. */
export const SALES_APPROVE = "sales.approve"

/** The permissions the Sales module declares. */
export const SALES_PERMISSIONS: ReadonlyArray<string> = [SALES_VIEW, SALES_MANAGE, SALES_APPROVE]

/** The most orders of one customer a detail looks through. */
export const ORDERS_OF_LEAD_LIMIT = 100

/** The most waiting orders the owner's region lists. */
export const WAITING_SHOWN = 5

/** Who the order says confirmed it when no member did: the agent. */
export const AGENT_NAME = "NIVO"

/** The URL query key of the chosen order, which a waiting row links to. */
export const ORDER_QUERY_KEY = "order"

/** The id of the view that lists the orders. */
export const ORDERS_VIEW_ID = "orders"
