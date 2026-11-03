"use client"

import { useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useTranslations } from "next-intl"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { uploadedFileOf } from "@/hooks/csv-import-wizard"
import { useRevalidateLeadViews } from "@/hooks/leads"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useMutateImportContractsSwr, useQueryPreviewContractImportSwr } from "@/hooks/swr"
import type { ContractImportPreview } from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { CONTRACT_IMPORT_FIELDS, CLOSED_CONTRACT_IMPORT, contractImportMappingOf } from "@/modules/sales"
import type { ContractImportField, ContractImportMapping, ContractImportState } from "@/modules/sales"

export type { ContractImportMapping } from "@/modules/sales"
type ImportState = ContractImportState<ContractImportPreview>
interface ImportOperation {
    readonly scope: string
    readonly isCurrent: () => boolean
}
interface ImportActivity {
    readonly isActive: boolean
    readonly scope: string
}

/** The exact selected native file or pasted text sent to the existing preview/import operations. */
const sourceInputOf = async (state: ImportState) => {
    if (state.source === "file" && state.file !== null)
        return { file: await uploadedFileOf(state.file), ...(state.sheet === null ? {} : { sheet: state.sheet }) }
    return { text: state.paste }
}

/** Owns the bulk import input and the real server preview/import commands for its original panel lifetime. */
export const useContractImport = (onDone: (message: string) => void, activity?: ImportActivity) => {
    const t = useTranslations("workbenchSales")
    const settle = useSettledGraphQL()
    const runGraphQL = useGraphQLWithToast()
    const revalidate = useRevalidateLeadViews()
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
    const commands = importCommandsOf({
        t,
        settle,
        runGraphQL,
        revalidate,
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
        ...importActionsOf(state, setState, commands),
    }
}

interface ImportCommandsInput {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly settle: ReturnType<typeof useSettledGraphQL>
    readonly runGraphQL: ReturnType<typeof useGraphQLWithToast>
    readonly revalidate: ReturnType<typeof useRevalidateLeadViews>
    readonly preview: ReturnType<typeof useQueryPreviewContractImportSwr>
    readonly importing: ReturnType<typeof useMutateImportContractsSwr>
    readonly state: ImportState
    readonly setState: Dispatch<SetStateAction<ImportState>>
    readonly scope: string
    readonly capture: () => () => boolean
    readonly setPreviewOperation: Dispatch<SetStateAction<ImportOperation | null>>
    readonly setImportOperation: Dispatch<SetStateAction<ImportOperation | null>>
    readonly onDone: (message: string) => void
}

/** Each named command observes its full tail and keeps only its own preview/import pending origin. */
const importCommandsOf = (input: ImportCommandsInput) => {
    const { t, state, setState, settle, runGraphQL, scope, capture } = input
    const runPreview = (next: ImportState, mapping: ContractImportMapping | null) => {
        const pending = { scope, isCurrent: capture() }
        if (!pending.isCurrent()) return
        input.setPreviewOperation(pending)
        setState({ ...next, mapping, error: null })
        const perform = async () => {
            const settled = await settle(async () =>
                input.preview.trigger({ ...(await sourceInputOf(next)), ...(mapping === null ? {} : { mapping }) }),
            )
            if (!pending.isCurrent()) return
            if (settled.kind === "failed") {
                setState({ ...next, mapping, preview: null, error: settled.message })
                return
            }
            setState({
                ...next,
                preview: settled.value,
                mapping: contractImportMappingOf(settled.value.mapping),
                error: null,
            })
        }
        perform()
            .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
            .finally(() => input.setPreviewOperation((current) => (current === pending ? null : current)))
    }
    const runImport = () => {
        const pending = { scope, isCurrent: capture() }
        if (!pending.isCurrent() || state.mapping === null) return
        input.setImportOperation(pending)
        const perform = async () => {
            const settled = await settle(async () =>
                input.importing.trigger({
                    ...(await sourceInputOf(state)),
                    mapping: state.mapping ?? contractImportMappingOf({}),
                }),
            )
            if (settled.kind === "failed") {
                if (pending.isCurrent()) setState({ ...state, error: settled.message })
                return
            }
            const message = t("contractImportDone", {
                created: settled.value.created,
                skipped: settled.value.skipped.length,
            })
            await input.revalidate()
            toast.success(message)
            if (!pending.isCurrent()) return
            input.onDone(message)
            setState(CLOSED_CONTRACT_IMPORT)
        }
        perform()
            .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
            .finally(() => input.setImportOperation((current) => (current === pending ? null : current)))
    }
    return { runPreview, runImport }
}

/** Native file selection and column editing remain the original import controls, not fabricated file metadata. */
const importActionsOf = (
    state: ImportState,
    setState: Dispatch<SetStateAction<ImportState>>,
    commands: ReturnType<typeof importCommandsOf>,
) => ({
    open: () => setState({ ...CLOSED_CONTRACT_IMPORT, isOpen: true }),
    close: () => setState(CLOSED_CONTRACT_IMPORT),
    source: (value: string) =>
        setState({ ...state, source: value === "paste" ? "paste" : "file", preview: null, mapping: null, error: null }),
    file: (files: ReadonlyArray<File>) => {
        const [file] = files
        if (file !== undefined) commands.runPreview({ ...state, file, sheet: null, preview: null }, null)
    },
    paste: (value: string) => setState({ ...state, paste: value }),
    sheet: (value: string | null) => {
        if (value !== null && state.file !== null) commands.runPreview({ ...state, sheet: value }, null)
    },
    preview: () => commands.runPreview({ ...state, preview: null }, null),
    column: (field: string, column: string | null) => {
        if (state.mapping === null) return
        const known: ContractImportField =
            CONTRACT_IMPORT_FIELDS.find((candidate) => candidate === field) ?? "customerName"
        commands.runPreview(state, { ...state.mapping, [known]: column })
    },
    runImport: commands.runImport,
})

/** The actual state and commands consumed by the import view. */
export type ContractImport = ReturnType<typeof useContractImport>
