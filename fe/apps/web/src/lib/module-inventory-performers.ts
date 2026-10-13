import type { Performed, Performer } from "./engine"

const MOVED = "The inventory actions are performed by the back end now."

/** Wave-3 shim: sending a purchase order is performed by the back end action performer; a decision taken here is refused. */
export const sendPurchaseOrder: Performer = {
    prepare: async (_ctx, item) => ({ proposal: item.proposal }),
    perform: async (): Promise<Performed> => {
        throw new Error(MOVED)
    },
}

/** Wave-3 shim: the approved quantity change is performed by the back end action performer; a decision taken here is refused. */
export const adjustStockPerformer: Performer = {
    prepare: async (_ctx, item) => ({ proposal: item.proposal }),
    perform: async (): Promise<Performed> => {
        throw new Error(MOVED)
    },
}
