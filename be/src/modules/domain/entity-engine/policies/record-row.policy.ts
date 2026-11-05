import { returnedRows, rowShape } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import type { RecordEntity } from "../persistence/entities"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { RecordRow } from "./compiler.contracts"

/** The columns a statement returns for a record, as the database names them. */
export const RECORD_RETURNING = "id, workspace_id, version, created_at, updated_at, data"

/** The selection of a query builder over `records` aliased `alias`: the property path and the column alias of each returned column. */
export const recordSelection = (alias: string): ReadonlyArray<readonly [string, string]> => [
    [`${alias}.id`, "id"],
    [`${alias}.workspaceId`, "workspace_id"],
    [`${alias}.version`, "version"],
    [`${alias}.createdAt`, "created_at"],
    [`${alias}.updatedAt`, "updated_at"],
    [`${alias}.data`, "data"],
]

const isRecordColumns = rowShape({
    id: "string",
    workspace_id: "string",
    version: "string",
    created_at: "date",
    updated_at: "date",
    data: "json",
})

/** The record a loaded entity row holds. */
export const recordRowOfEntity = (record: RecordEntity): RecordRow => ({
    id: record.id,
    workspaceId: record.workspaceId,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    data: record.data,
})

/** The records a RETURNING statement or a raw select answered, each checked against the returned columns (never cast). */
export const recordRowsOf = (raw: unknown): Array<RecordRow> =>
    returnedRows(raw, isRecordColumns).map((row) => {
        if (!isRecord(row.data))
            throw new EntityEngineError({ code: EntityEngineErrorCode.ValueInvalid, params: { column: "data" } })
        return {
            id: row.id,
            workspaceId: row.workspace_id,
            version: row.version,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
            data: row.data,
        }
    })

/** The one record of a statement that must answer exactly one. */
export const onlyRecord = (rows: ReadonlyArray<RecordRow>): RecordRow => {
    const [row] = rows
    if (row === undefined) throw new EntityEngineError({ code: EntityEngineErrorCode.ResultMissing })
    return row
}

/** The declared fields in `select` that `data` holds. */
export const pickFields = (
    data: Readonly<Record<string, unknown>>,
    select: ReadonlyArray<string>,
): Record<string, unknown> =>
    Object.fromEntries(select.filter((name) => Object.hasOwn(data, name)).map((name) => [name, data[name]]))

/** The record with only the declared fields in `select` (system fields stay as columns). */
export const projectRecord = (row: RecordRow, select: ReadonlyArray<string>): RecordRow => ({
    ...row,
    data: pickFields(row.data, select),
})
