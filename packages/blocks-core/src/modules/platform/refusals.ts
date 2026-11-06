import type { ActionResult } from "@nivo-lite/agent-sdk/block"

/** Why a platform action refused, each with a message of the module. */
export type PlatformRefusal = "missing" | "not_parked" | "forbidden"

/** A domain refusal as data: the words come from the module's catalogue under `refusal_<reason>`. */
export const refusedWith = (reason: PlatformRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: { key: `refusal_${reason}` },
})
