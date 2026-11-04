"use client"

import { useState } from "react"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useMutateImportContractsSwr, useQueryPreviewContractImportSwr } from "@/hooks/swr"
import { CLOSED_CONTRACT_IMPORT } from "@/modules/sales"
import { useContractImportActions } from "./useContractImportActions"
import type { ImportOperation, ImportState } from "./useContractImportActions"

export type { ContractImportMapping } from "@/modules/sales"
interface ImportActivity {
    readonly isActive: boolean
    readonly scope: string
}

type UseContractImportResult = {
    open: () => void
    close: () => void
    source: (value: string) => void
    file: (files: ReadonlyArray<File>) => void
    paste: (value: string) => void
    sheet: (value: string | null) => void
    preview: () => void
    column: (field: string, column: string | null) => void
    runImport: () => void
    state: ImportState
    isPreviewing: boolean
    isImporting: boolean
}

/** Owns the bulk import input and the real server preview/import commands for its original panel lifetime. */
export const useContractImport = (
    onDone: (message: string) => void,
    activity?: ImportActivity,
): UseContractImportResult => {
    const preview = useQueryPreviewContractImportSwr()
    const importing = useMutateImportContractsSwr()
    const isActive = activity?.isActive ?? true,
        scope = activity?.scope ?? ""
    const lifetime = useFeatureLifetime(isActive, scope)
    const [state, setState] = useState<ImportState>(CLOSED_CONTRACT_IMPORT)
    const [previewOperation, setPreviewOperation] = useState<ImportOperation | null>(null)
    const [importOperation, setImportOperation] = useState<ImportOperation | null>(null)
    useFeatureReset({
        isActive,
        isReady: true,
        scope,
        onReset: () => {
            setState(CLOSED_CONTRACT_IMPORT)
            setPreviewOperation(null)
            setImportOperation(null)
        },
    })
    const actions = useContractImportActions({
        preview,
        importing,
        state,
        setState,
        scope,
        capture: lifetime.capture,
        setPreviewOperation,
        setImportOperation,
        onDone,
    })
    return {
        state,
        isPreviewing:
            activity === undefined
                ? preview.isMutating
                : previewOperation?.scope === scope && previewOperation.isCurrent(),
        isImporting:
            activity === undefined
                ? importing.isMutating
                : importOperation?.scope === scope && importOperation.isCurrent(),
        ...actions,
    }
}

/** The actual state and commands consumed by the import view. */
export type ContractImport = ReturnType<typeof useContractImport>
