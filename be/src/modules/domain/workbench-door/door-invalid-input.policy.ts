import type { ActionResult } from "@nivo-lite/agent-sdk/block"

/** What the log says of an action that refused its input: the action and the keys of the refused fields, never a value. */
export interface InvalidInput {
    /** The action that refused. */
    readonly action: string
    /** The keys of the fields it refused. */
    readonly fields: ReadonlyArray<string>
}

/** What to log for the result of an action: its name and field keys when it refused its input as invalid, else nothing. */
export const invalidInputOf = (action: string, result: ActionResult): InvalidInput | null =>
    !result.ok && result.reason === "invalid" ? { action, fields: Object.keys(result.fields ?? {}) } : null
