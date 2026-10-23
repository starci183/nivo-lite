"use client"

import { useSettledGraphQL, type Settled } from "@/hooks/connection-wizard"

import { useConnectionsRefresh } from "@/hooks/connections"
import {
    useMutateSaveDatabaseConnectionSwr,
    useQueryPreviewDatabaseTableSwr,
    useQueryTestDatabaseSwr,
} from "@/hooks/swr"
import type { DbPreviewRows, DbTableInfo, DbTableMapping, DbTarget } from "@/modules/types"
import { useMemo } from "react"

/** What saving a database connection takes. */
export interface DatabaseSaveForm {
    readonly connectionId?: string | undefined
    readonly name: string
    readonly target: DbTarget
    readonly tables: ReadonlyArray<DbTableMapping>
    readonly everyMinutes: number | null
}

/** The GraphQL commands of the database wizard (the active workspace travels in the request header). */
export interface DatabaseCommands {
    readonly test: (connectionId: string | undefined, target: DbTarget) => Promise<Settled<ReadonlyArray<DbTableInfo>>>
    readonly preview: (
        connectionId: string | undefined,
        target: DbTarget,
        mapping: DbTableMapping,
    ) => Promise<Settled<DbPreviewRows>>
    readonly save: (form: DatabaseSaveForm) => Promise<Settled<string>>
}

/** The database wizard's test, preview and save bound to the toast helper. */
export const useDatabaseCommands = (): DatabaseCommands => {
    const { trigger: triggerSave } = useMutateSaveDatabaseConnectionSwr()
    const settle = useSettledGraphQL()
    const { trigger: testDatabase } = useQueryTestDatabaseSwr()
    const { trigger: previewTable } = useQueryPreviewDatabaseTableSwr()
    const refresh = useConnectionsRefresh()
    return useMemo(
        () => ({
            test: (connectionId, target) =>
                settle(async () => {
                    return testDatabase({ connectionId, target })
                }),
            preview: (connectionId, target, mapping) =>
                settle(async () => {
                    const { columns, rows } = await previewTable({ connectionId, target, mapping })
                    return { columns, rows: rows.map((row) => row.cells) }
                }),
            save: async (form) => {
                const settled = await settle(() =>
                    triggerSave({
                        connectionId: form.connectionId,
                        name: form.name,
                        target: form.target,
                        tables: form.tables,
                        everyMinutes: form.everyMinutes,
                    }),
                )
                if (settled.kind === "ok") await refresh()
                return settled
            },
        }),
        [settle, refresh, triggerSave, testDatabase, previewTable],
    )
}
