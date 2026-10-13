"use client"

import { useMemo } from "react"
import { useQueryLoadDatabaseConnectionSwr } from "@/hooks/swr/api/graphql/queries/useQueryLoadDatabaseConnectionSwr"
import type { DbSavedConnection } from "@/modules/types"
import { dbSavedOf } from "./database-wizard.shared"

/** A saved database connection reopened for editing: `saved` once loaded, `error` with the back end message when it failed; `isLoading` while it is on its way. */
export const useDatabaseSaved = (connectionId: string | undefined) => {
    const { data, error, isLoading } = useQueryLoadDatabaseConnectionSwr(connectionId, {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
    })
    const saved = useMemo<DbSavedConnection | null>(() => (data === undefined ? null : dbSavedOf(data)), [data])
    return { saved, isLoading, error: error instanceof Error ? error.message : undefined }
}
