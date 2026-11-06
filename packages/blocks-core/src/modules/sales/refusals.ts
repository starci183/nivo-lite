import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EngineResult } from "@nivo-lite/agent-sdk/entity/port"

/** Why a Sales action refused, each with a message of the module. */
export type SalesRefusal =
    | "missing"
    | "same_stage"
    | "stage_not_allowed"
    | "reopen_needs_owner"
    | "reason_required"
    | "order_not_confirmable"
    | "order_not_cancellable"
    | "settings_not_saved"
    | "not_awaiting"
    | "phone_required"
    | "phone_taken"

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

/** A write the engine did not make, as a refusal: the record is gone, or its version moved since it was read. */
export const writeRefusal = (result: Extract<EngineResult, { readonly ok: false }>): ActionResult =>
    result.reason === "missing" ? refusedWith("missing") : CONFLICT
