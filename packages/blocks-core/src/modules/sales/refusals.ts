import type { ActionResult } from "@nivo-lite/agent-sdk/block"

/** Why a Sales action refused, each with a message of the module. */
export type SalesRefusal =
    | "missing"
    | "same_stage"
    | "stage_not_allowed"
    | "reason_required"
    | "order_not_confirmable"
    | "order_not_cancellable"

/** A domain refusal as data: the words come from the module's catalogue under `refusal_<reason>`. */
export const refusedWith = (reason: SalesRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: { key: `refusal_${reason}` },
})

/** The answer to a write another writer got to first: the person reloads and tries again. */
export const CONFLICT: ActionResult = { ok: false, reason: "conflict", message: { key: "refusal_conflict" } }

/** The answer to a confirmation an order must wait for the owner to make: refused, with the threshold as data. */
export const waitsForOwnerResult = (thresholdVnd: number): ActionResult => ({
    ok: false,
    reason: "refused",
    message: { key: "refusal_order_waits_owner" },
    data: { waiting: true, thresholdVnd },
})
