import type { ConnectionCommand } from "./connection-commands.contracts"
import type { ConnectionCommandEntity } from "./persistence/entities"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The command a row describes; an input that is not an object is read as no fields. */
export const toConnectionCommand = (row: ConnectionCommandEntity): ConnectionCommand => ({
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    kind: row.kind,
    input: isRecord(row.input) ? row.input : {},
    status: row.status === "done" ? "done" : "pending",
})
