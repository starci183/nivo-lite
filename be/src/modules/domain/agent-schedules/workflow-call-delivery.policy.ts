import type { DeliverResult } from "@modules/domain/provider-triggers"

/**
 * What delivering one workflow call came to, as its three callers read it (a declared job's start, a run's hand-off, the team chat's
 * turn): a registered graph took it and a wake was written (`started`), the same call was delivered before (`duplicate`), or nothing was
 * written (`refused`: the delivery is off, the data failed its schema, or no live registration of the callee takes the call).
 */
export type CallDelivery = "started" | "duplicate" | "refused"

/** What the delivery's answer says of one call. */
export const callDeliveryOf = (result: DeliverResult): CallDelivery => {
    if (result.status !== "delivered") return "refused"
    if (result.woken.length > 0) return "started"
    return result.repeats > 0 ? "duplicate" : "refused"
}
