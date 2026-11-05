import type { ActionDefinition, InputProblem, ReadDefinition } from "../block/block.types"
import { parseStrict } from "../block/input"

/** The variables of a read as the door accepts them, or why it refuses. */
export type ReadVariablesResult =
    | { readonly ok: true; readonly variables: Readonly<Record<string, unknown>> }
    | { readonly ok: false; readonly problems: ReadonlyArray<InputProblem> }

/** The input of an action as the door accepts it, or why it refuses. */
export type ActionInputResult =
    | { readonly ok: true; readonly input: Readonly<Record<string, unknown>> }
    | { readonly ok: false; readonly problems: ReadonlyArray<InputProblem> }

/** Parses the raw variables a request carries against the read's zod object; a key the read does not declare is refused. */
export const readVariablesOf = (read: ReadDefinition, raw: unknown): ReadVariablesResult => {
    const parsed = parseStrict(read.variables, raw)
    return parsed.ok ? { ok: true, variables: parsed.value } : parsed
}

/**
 * Parses the raw payload a request carries against the action's `input`; a key the action does not declare is refused. An action
 * without a declared input (a host-operation action) cannot be run by the door, so every payload is refused as a whole.
 */
export const actionInputOf = (action: ActionDefinition, raw: unknown): ActionInputResult => {
    if (action.input === undefined) return { ok: false, problems: [{ code: "INPUT_INVALID", at: "." }] }
    const parsed = parseStrict(action.input, raw)
    return parsed.ok ? { ok: true, input: parsed.value } : parsed
}
