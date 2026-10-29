import type { LeadActionRun } from "../lead-actions.contracts"

/** The rows an `UPDATE ... RETURNING` answered, each as a plain record. */
export const returnedRows = (raw: unknown): ReadonlyArray<object> =>
    Array.isArray(raw) ? raw.filter((row): row is object => typeof row === "object" && row !== null) : []

/** The run a `RETURNING` write answered, read from its snake-case columns; undefined when the write answered nothing. */
export const runOfRaw = (raw: unknown): LeadActionRun | undefined => {
    const [row] = returnedRows(raw)
    if (row === undefined) return undefined
    return {
        id: Reflect.get(row, "id"),
        workspaceId: Reflect.get(row, "workspace_id"),
        requestedBy: Reflect.get(row, "requested_by"),
        action: Reflect.get(row, "action"),
        input: Reflect.get(row, "input"),
        locale: Reflect.get(row, "locale"),
        status: Reflect.get(row, "status"),
        result: Reflect.get(row, "result"),
        errorCode: Reflect.get(row, "error_code"),
    }
}
