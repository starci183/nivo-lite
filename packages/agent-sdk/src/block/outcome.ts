import type { ActionOutcome, ActionResult } from "./block.types"

/** What a block sees of an action that ran in the package: the result of its `run`, one for one. */
export const outcomeOf = (result: ActionResult): ActionOutcome => {
    if (result.ok) return result.data === undefined ? { ok: true } : { ok: true, data: result.data }
    const data = result.data === undefined ? {} : { data: result.data }
    if (result.reason === "invalid")
        return { ok: false, reason: "invalid", fields: result.fields ?? {}, message: result.message, ...data }
    return { ok: false, reason: result.reason, message: result.message, ...data }
}
