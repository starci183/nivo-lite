import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EngineResult } from "@nivo-lite/agent-sdk/entity/port"

/** Why a Booking action refused, each with a message of the module under `refusal_<reason>`. */
export type BookingRefusal = "record_missing" | "status_closed"

/** A domain refusal as data. */
export const refusedWith = (reason: BookingRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: { key: `refusal_${reason}` },
})

/** A write the engine did not make, as a refusal: the record is gone, or another writer got to it first. */
export const writeRefusal = (result: Extract<EngineResult, { readonly ok: false }>): ActionResult =>
    result.reason === "missing"
        ? refusedWith("record_missing")
        : { ok: false, reason: "conflict", message: { key: "refusal_conflict" } }

/** The answer of a write: its record id, or why it did not happen. */
export const writtenOf = (result: EngineResult): ActionResult =>
    result.ok ? { ok: true, data: { id: result.row.id } } : writeRefusal(result)
