"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { uploadedFileOf } from "@/hooks/csv-import-wizard"
import { useRevalidateLeadViews } from "@/hooks/leads"
import { useMutateImportContractsSwr, useQueryPreviewContractImportSwr } from "@/hooks/swr"
import type { ContractImportPreview } from "@/hooks/swr"
import { toast } from "@/modules/toast"
import { CONTRACT_IMPORT_FIELDS } from "./salescontracts.shared"
import type { ContractImportField } from "./salescontracts.shared"

/** Where the contract rows come from. */
export type ContractImportSource = "file" | "paste"

/** Which column fills each field; null leaves it empty. */
export type ContractImportMapping = Readonly<Record<ContractImportField, string | null>>

/** The source the person chose, as the back end reads it. */
interface SourceInput {
    readonly file?: { readonly name: string; readonly contentBase64: string }
    readonly sheet?: string
    readonly text?: string
}

/** What the import dialog holds: the source, the preview and the mapping the person edits. */
interface ContractImportState {
    readonly isOpen: boolean
    readonly source: ContractImportSource
    readonly file: File | null
    readonly paste: string
    readonly sheet: string | null
    readonly preview: ContractImportPreview | null
    readonly mapping: ContractImportMapping | null
    readonly error: string | null
}

const CLOSED: ContractImportState = {
    isOpen: false,
    source: "file",
    file: null,
    paste: "",
    sheet: null,
    preview: null,
    mapping: null,
    error: null,
}

/** The seven columns of a mapping the back end answered, without anything else it carries. */
const mappingOf = (raw: Partial<Record<ContractImportField, string | null>>): ContractImportMapping => ({
    customerName: raw.customerName ?? null,
    plan: raw.plan ?? null,
    startsOn: raw.startsOn ?? null,
    endsOn: raw.endsOn ?? null,
    amountVnd: raw.amountVnd ?? null,
    status: raw.status ?? null,
    note: raw.note ?? null,
})

const sourceInputOf = async (state: ContractImportState): Promise<SourceInput> => {
    if (state.source === "file" && state.file !== null) {
        return { file: await uploadedFileOf(state.file), ...(state.sheet === null ? {} : { sheet: state.sheet }) }
    }
    return { text: state.paste }
}

/**
 * The bulk contract import: choose a file or paste a table, preview it with a suggested (editable) column mapping and the
 * problems of each row, then import; `onDone` gets the "imported N, skipped M" line once the list is read again.
 */
export const useContractImport = (onDone: (message: string) => void) => {
    const t = useTranslations("workbenchSales")
    const settle = useSettledGraphQL()
    const revalidate = useRevalidateLeadViews()
    const { trigger: previewSource, isMutating: isPreviewing } = useQueryPreviewContractImportSwr()
    const { trigger: importRows, isMutating: isImporting } = useMutateImportContractsSwr()
    const [state, setState] = useState<ContractImportState>(CLOSED)

    const runPreview = useCallback(
        async (next: ContractImportState, mapping: ContractImportMapping | null) => {
            setState({ ...next, mapping, error: null })
            const settled = await settle(async () =>
                previewSource({ ...(await sourceInputOf(next)), ...(mapping === null ? {} : { mapping }) }),
            )
            if (settled.kind === "failed") {
                setState({ ...next, mapping, preview: null, error: settled.message })
                return
            }
            setState({ ...next, preview: settled.value, mapping: mappingOf(settled.value.mapping), error: null })
        },
        [previewSource, settle],
    )

    const runImport = useCallback(async () => {
        if (state.mapping === null) return
        const settled = await settle(async () =>
            importRows({ ...(await sourceInputOf(state)), mapping: state.mapping ?? mappingOf({}) }),
        )
        if (settled.kind === "failed") {
            setState({ ...state, error: settled.message })
            return
        }
        const message = t("contractImportDone", {
            created: settled.value.created,
            skipped: settled.value.skipped.length,
        })
        await revalidate()
        toast.success(message)
        onDone(message)
        setState(CLOSED)
    }, [importRows, onDone, revalidate, settle, state, t])

    return {
        state,
        isPreviewing,
        isImporting,
        open: () => setState({ ...CLOSED, isOpen: true }),
        close: () => setState(CLOSED),
        source: (value: string) =>
            setState({
                ...state,
                source: value === "paste" ? "paste" : "file",
                preview: null,
                mapping: null,
                error: null,
            }),
        file: (files: ReadonlyArray<File>) => {
            const [file] = files
            if (file === undefined) return
            void runPreview({ ...state, file, sheet: null, preview: null }, null)
        },
        paste: (value: string) => setState({ ...state, paste: value }),
        sheet: (value: string | null) => {
            if (value === null || state.file === null) return
            void runPreview({ ...state, sheet: value }, null)
        },
        preview: () => void runPreview({ ...state, preview: null }, null),
        column: (field: string, column: string | null) => {
            if (state.mapping === null) return
            const known = CONTRACT_IMPORT_FIELDS.find((candidate) => candidate === field) ?? "customerName"
            void runPreview(state, { ...state.mapping, [known]: column })
        },
        runImport: () => void runImport(),
    }
}

/** The state and commands of the bulk contract import. */
export type ContractImport = ReturnType<typeof useContractImport>
