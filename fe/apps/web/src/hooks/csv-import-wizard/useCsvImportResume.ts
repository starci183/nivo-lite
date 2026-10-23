"use client"

import { useMemo } from "react"
import { useQueryLoadCsvImportSwr } from "@/hooks/swr"
import { parseConfig } from "./csv-import-wizard.shared"
import type { CsvSavedImport } from "./csv-import-wizard.shared"
import { readError } from "@/hooks/workspaceread"

/** What loading the saved import of a resume answers: the import, still loading, or the reason it failed. */
export interface CsvImportResume {
    readonly saved: CsvSavedImport | null
    readonly isLoading: boolean
    readonly error: string | undefined
}

/** Loads the saved setup of the import being resumed (nothing to load when `resumeId` is absent). */
export const useCsvImportResume = (resumeId: string | undefined): CsvImportResume => {
    const swrRead = useQueryLoadCsvImportSwr(resumeId, { revalidateOnFocus: false })
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return useMemo(() => {
        if (resumeId === undefined) return { saved: null, isLoading: false, error: undefined }
        if (error instanceof Error) return { saved: null, isLoading: false, error: error.message }
        if (data === undefined) return { saved: null, isLoading, error: undefined }
        const config = parseConfig(data.config)
        if (config === null)
            return { saved: null, isLoading: false, error: "loadCsvImport answered an unreadable config" }
        return {
            saved: {
                name: data.name,
                config,
                file: data.file,
                summary: data.summary,
                agentIds: data.agentIds,
                scheduleMinutes: data.scheduleMinutes ?? null,
            },
            isLoading: false,
            error: undefined,
        }
    }, [resumeId, data, error, isLoading])
}
