"use client"

import { useMemo } from "react"
import { useQueryLoadDatabaseConnectionSwr } from "@/hooks/swr"
import type { SlotRead } from "@/hooks/slot"
import type { DbSavedConnection } from "@/modules/types"
import { dbSavedOf } from "./database-wizard.shared"
import { readError } from "@/hooks/workspaceread"

/** The view `useDatabaseSaved` returns. */
export interface DatabaseSavedView {
    reads: readonly SlotRead<unknown>[]
    saved: DbSavedConnection | null
    isLoading: boolean
    error: string | undefined
    reload: () => undefined
}

/** A saved database connection reopened for editing: `saved` once loaded, `error` with the back end message when it failed; `isLoading` while it is on its way; `reload` reads it again. */
export const useDatabaseSaved = (connectionId: string | undefined): DatabaseSavedView => {
    const swrRead = useQueryLoadDatabaseConnectionSwr(connectionId, {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
    })
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const saved = useMemo<DbSavedConnection | null>(() => (data === undefined ? null : dbSavedOf(data)), [data])
    const reads: ReadonlyArray<SlotRead<unknown>> = connectionId === undefined ? [] : [swrRead]
    return {
        reads,
        saved,
        isLoading,
        error: error instanceof Error ? error.message : undefined,
        reload: () => void swrRead.mutate(),
    }
}
