import { LeadActionEntity } from "./entities"

/** The database instant of a write, for the `updated_at` column. */
export const NOW = (): string => "now()"

/** The rows an `UPDATE ... RETURNING` answered, each as a plain record. */
export const returnedRows = (raw: unknown): ReadonlyArray<object> =>
    Array.isArray(raw) ? raw.filter((row): row is object => typeof row === "object" && row !== null) : []

/** The entity property and the column it reads, for the columns the begin of a run returns. */
const COLUMNS: ReadonlyArray<readonly [string, string]> = [
    ["id", "id"],
    ["workspaceId", "workspace_id"],
    ["requestedBy", "requested_by"],
    ["action", "action"],
    ["input", "input"],
    ["locale", "locale"],
    ["status", "status"],
    ["result", "result"],
    ["errorCode", "error_code"],
]

/** The run a `RETURNING` write answered, read as an entity; undefined when the write answered nothing. */
export const runOfRaw = (raw: unknown): LeadActionEntity | undefined => {
    const [row] = returnedRows(raw)
    return row === undefined
        ? undefined
        : Object.assign(
              new LeadActionEntity(),
              Object.fromEntries(COLUMNS.map(([property, column]) => [property, Reflect.get(row, column)])),
          )
}
