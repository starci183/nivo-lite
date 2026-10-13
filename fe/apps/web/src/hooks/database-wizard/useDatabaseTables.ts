"use client"

import { useReducer } from "react"
import type { DbPreviewRows, DbTableInfo, DbTableMapping, DbTarget } from "@/modules/types"
import {
    DB_MAX_COLUMNS,
    DB_NO_COLUMN,
    dbColumnOptions,
    dbDefaultMapping,
    dbEntityOf,
    dbOptionalColumnOf,
    dbPreviewLines,
    dbTableKey,
} from "./database-wizard.shared"
import type { DatabaseCommands } from "./useDatabaseCommands"

/** The 5-row previews of the mapped tables, keyed by table key. */
interface DatabasePreviewState {
    readonly rows: Readonly<Record<string, DbPreviewRows>>
    readonly errors: Readonly<Record<string, string>>
    readonly loading: ReadonlyArray<string>
}

/** One change to the previews, computed from the latest state. */
type PreviewPatch = (state: DatabasePreviewState) => DatabasePreviewState

/** What the table step works on: the listed tables, the picked mappings and how to change them. */
interface DatabaseTablesInput {
    readonly commands: DatabaseCommands
    readonly connectionId: string | undefined
    readonly target: () => DbTarget
    readonly tables: ReadonlyArray<DbTableInfo> | null
    readonly picked: ReadonlyArray<DbTableMapping>
    readonly update: (change: (picked: ReadonlyArray<DbTableMapping>) => ReadonlyArray<DbTableMapping>) => void
}

/** The optional columns of a mapping a select can set. */
type DbOptionalColumn = "titleColumn" | "updatedColumn"

const EMPTY: DatabasePreviewState = { rows: {}, errors: {}, loading: [] }

const without = <T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> =>
    Object.fromEntries(Object.entries(record).filter(([name]) => name !== key))

const apply = (state: DatabasePreviewState, patch: PreviewPatch): DatabasePreviewState => patch(state)

/** The table step: tick tables, map each one, and load a 5-row preview per table (each loads and fails on its own). */
export const useDatabaseTables = ({ commands, connectionId, target, tables, picked, update }: DatabaseTablesInput) => {
    const [previews, dispatch] = useReducer(apply, EMPTY)
    const change = (key: string, patch: Partial<DbTableMapping>) =>
        update((list) => list.map((m) => (dbTableKey(m) === key ? { ...m, ...patch } : m)))
    const load = async (mapping: DbTableMapping) => {
        const key = dbTableKey(mapping)
        dispatch((s) => ({ ...s, errors: without(s.errors, key), loading: [...s.loading, key] }))
        const answer = await commands.preview(connectionId, target(), mapping)
        dispatch((s) => ({
            rows: answer.kind === "ok" ? { ...s.rows, [key]: answer.value } : without(s.rows, key),
            errors: answer.kind === "ok" ? s.errors : { ...s.errors, [key]: answer.message },
            loading: s.loading.filter((name) => name !== key),
        }))
    }
    const mapped = picked.flatMap((mapping) => {
        const key = dbTableKey(mapping)
        const info = tables?.find((x) => x.schema === mapping.schema && x.name === mapping.table)
        if (info === undefined) return []
        const rows = previews.rows[key]
        return [
            {
                key,
                id: `db-${key.replace(/\W/g, "-")}`,
                table: mapping.table,
                entity: mapping.entity,
                idColumn: mapping.idColumn || null,
                titleColumn: mapping.titleColumn || DB_NO_COLUMN,
                updatedColumn: mapping.updatedColumn || DB_NO_COLUMN,
                columns: mapping.columns,
                names: dbColumnOptions(info),
                isOverCap: info.columns.length > DB_MAX_COLUMNS,
                isPreviewing: previews.loading.includes(key),
                error: previews.errors[key] ?? null,
                lines: rows === undefined ? null : dbPreviewLines(rows),
            },
        ]
    })
    return {
        mapped,
        toggle: (keys: ReadonlyArray<string>) => {
            if (tables === null) return
            update((list) =>
                keys.flatMap((key) => {
                    const have = list.find((m) => dbTableKey(m) === key)
                    if (have) return [have]
                    const info = tables.find((x) => dbTableKey(x) === key)
                    return info ? [dbDefaultMapping(info)] : []
                }),
            )
        },
        setEntity: (key: string, value: string | null) => change(key, { entity: dbEntityOf(value) }),
        setIdColumn: (key: string, value: string | null) => change(key, { idColumn: value ?? "" }),
        setOptionalColumn: (key: string, column: DbOptionalColumn, value: string | null) =>
            change(key, { [column]: dbOptionalColumnOf(value) }),
        setColumns: (key: string, value: ReadonlyArray<string>) =>
            change(key, { columns: value.slice(0, DB_MAX_COLUMNS) }),
        preview: (key: string) => {
            const mapping = picked.find((m) => dbTableKey(m) === key)
            if (mapping !== undefined) void load(mapping)
        },
    }
}
