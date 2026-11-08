"use client"

import { useCallback, useMemo } from "react"
import { useQueryLoadCsvImportSwr } from "@/hooks/swr"
import type { SlotRead } from "@/hooks/slot"
import { parseConfig, type CsvSavedImport } from "./csv-import-wizard.shared"
import { readError } from "@/hooks/workspaceread"

/** What loading the saved import of a resume answers: the import, still loading, or the reason it failed. */
export interface CsvImportResume {
    readonly reads: ReadonlyArray<SlotRead<unknown>>
    readonly saved: CsvSavedImport | null
    readonly isLoading: boolean
    readonly error: string | undefined
    /** Reads the saved import again after the read failed. */
    readonly reload: () => void
}

/** Loads the saved setup of the import being resumed (nothing to load when `resumeId` is absent). */
export const useCsvImportResume = (resumeId: string | undefined): CsvImportResume => {
    const swrRead = useQueryLoadCsvImportSwr(resumeId, { revalidateOnFocus: false })
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const { mutate } = swrRead
    const reload = useCallback(() => void mutate(), [mutate])
    const read = useMemo<SlotRead<CsvSavedImport>>(() => {
        const config = data === undefined ? undefined : parseConfig(data.config)
        return {
            data:
                data === undefined || config === undefined || config === null
                    ? undefined
                    : {
                          name: data.name,
                          config,
                          file: data.file,
                          summary: data.summary,
                          agentIds: data.agentIds,
                          scheduleMinutes: data.scheduleMinutes ?? null,
                      },
            isLoading,
            isValidating: swrRead.isValidating,
            error: config === null ? new Error("loadCsvImport answered an unreadable config") : error,
        }
    }, [data, error, isLoading, swrRead.isValidating])
    return {
        reads: resumeId === undefined ? [] : [read],
        saved: resumeId === undefined ? null : (read.data ?? null),
        isLoading: resumeId !== undefined && read.data === undefined && read.isLoading,
        error: read.error instanceof Error ? read.error.message : undefined,
        reload,
    }
}
