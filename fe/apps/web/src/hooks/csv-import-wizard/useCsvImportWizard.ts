"use client"

import { useCsvImportWizardState } from "./useCsvImportWizardState"
import type { AgentOption, WizardNote, SlotRead } from "@/modules/types"
import type {
    CsvEntity,
    CsvImportResult,
    CsvMapping,
    CsvPreview,
    CsvSavedImport,
    CsvSource,
    CsvStep,
    Grid,
} from "./csv-import-wizard.shared"
import type { Dispatch, SetStateAction } from "react"

/** What the import wizard needs from its drawer. */
export interface CsvImportWizardInput {
    readonly agents: ReadonlyArray<AgentOption>
    /** Add more data to this existing import instead of creating a new one. */
    readonly resumeId?: string
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** The wizard's own state; a field left undefined still follows the saved import (or the default of a new one). */
export interface CsvImportFields {
    readonly index?: number
    readonly source?: CsvSource
    readonly entity?: Exclude<CsvEntity, "document">
    readonly schedule?: string
    readonly link?: string
    readonly agentIds?: ReadonlyArray<string>
    readonly file: File | null
    readonly docs: ReadonlyArray<File>
    readonly preview: CsvPreview | null
    readonly mapping: CsvMapping | null
    readonly result: CsvImportResult | null
    readonly note: WizardNote | null
}

/** The view `useCsvImportWizard` returns. */
export interface CsvImportWizardView {
    reads: readonly SlotRead<unknown>[]
    isLoading: boolean
    loadError: string | null
    saved: CsvSavedImport | null
    index: number
    steps: readonly CsvStep[]
    step: CsvStep
    canGoBack: boolean
    form: {
        name: string
        entity: "other" | "transaction" | "customer" | "order" | "product"
        schedule: string
        link: string
        paste: string
    }
    source: CsvSource
    grid: Grid
    file: File | null
    docs: readonly File[]
    preview: CsvPreview | null
    mapping: CsvMapping | null
    result: CsvImportResult | null
    note: WizardNote | null
    agentIds: readonly string[]
    isPending: boolean
    on: {
        go: (to: number) => void
        read: () => undefined
        sheet: (sheet: string) => undefined
        runImport: () => undefined
        finish: () => undefined
        close: () => void
        retry: () => void
        name: (value: string) => void
        entity: (value: string | null) => void
        source: (value: string) => void
        schedule: (value: string | null) => void
        file: (files: ReadonlyArray<File>) => void
        link: (value: string) => void
        docs: (files: ReadonlyArray<File>) => void
        column: (key: "idColumn" | "titleColumn" | "dateColumn", value: string | null) => void
        agents: (ids: ReadonlyArray<string>) => void
        paste: Dispatch<SetStateAction<string>>
        applyPaste: () => void
        rename: (columnId: string, name: string) => void
        cell: (rowId: string, columnId: string, value: string) => void
        addRow: () => void
        removeRow: (rowId: string) => void
        addColumn: () => void
    }
}

/** The import wizard: see `useCsvImportWizardState`. */
export const useCsvImportWizard = (input: CsvImportWizardInput): CsvImportWizardView => useCsvImportWizardState(input)
