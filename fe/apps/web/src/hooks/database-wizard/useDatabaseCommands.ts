"use client"

import { useMemo } from "react"
import { answeredData, useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateSaveDatabaseConnectionSwr } from "@/hooks/swr"
import { queryPreviewDatabaseTable } from "@/modules/api/graphql/queries/query-preview-database-table"
import { queryTestDatabase } from "@/modules/api/graphql/queries/query-test-database"
import type { DbPreviewRows, DbTableInfo, DbTableMapping, DbTarget } from "@/modules/types"

/** What saving a database connection takes. */
export interface DatabaseSaveForm {
    readonly connectionId?: string
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
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger: triggerSave } = useMutateSaveDatabaseConnectionSwr()
    return useMemo(
        () => ({
            test: (connectionId, target) =>
                settle(async () => {
                    const data = answeredData(
                        await queryTestDatabase({ request: { connectionId, target } }),
                        "testDatabase",
                    )
                    return data.testDatabase
                }),
            preview: (connectionId, target, mapping) =>
                settle(async () => {
                    const data = answeredData(
                        await queryPreviewDatabaseTable({ request: { connectionId, target, mapping } }),
                        "previewDatabaseTable",
                    )
                    const { columns, rows } = data.previewDatabaseTable
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
                if (settled.kind !== "ok") return settled
                await refresh()
                return settled
            },
        }),
        [settle, refresh, triggerSave],
    )
}
