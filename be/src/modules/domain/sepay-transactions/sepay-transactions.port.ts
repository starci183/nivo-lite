import type { EntityManager } from "typeorm"

/**
 * What a capability does once a transfer has settled one of its orders: it writes its own records in the transaction of the settlement,
 * so the order is never paid without them. Bound at the app root; with nothing bound, a settled order needs nothing more.
 */
export interface PaidOrderFulfilment {
    /** Fulfils the order with this code if it is the kind this capability sells; any other order is left alone. */
    fulfil(manager: EntityManager, orderCode: string): Promise<void>
}
