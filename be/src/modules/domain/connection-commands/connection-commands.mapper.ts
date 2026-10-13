import type { ConnectionCommand } from "./connection-commands.contracts"
import type { ConnectionCommandRow } from "./persistence/connection-commands.rows"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The command a row describes; an input that is not an object is read as no fields. */
export const toConnectionCommand = (row: ConnectionCommandRow): ConnectionCommand => ({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    kind: row.kind,
    input: isRecord(row.input) ? row.input : {},
    status: row.status === "done" ? "done" : "pending",
})
