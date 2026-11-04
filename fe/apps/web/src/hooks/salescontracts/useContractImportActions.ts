import type { Dispatch, SetStateAction } from "react"
import { useTranslations } from "next-intl"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { uploadedFileOf } from "@/hooks/csv-import-wizard"
import { useRevalidateLeadViews } from "@/hooks/leads"
import type { ContractImportPreview, useMutateImportContractsSwr, useQueryPreviewContractImportSwr } from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { CONTRACT_IMPORT_FIELDS, CLOSED_CONTRACT_IMPORT, contractImportMappingOf } from "@/modules/sales"
import type { ContractImportField, ContractImportMapping, ContractImportState } from "@/modules/sales"

/** The import dialog state with the server preview it holds. */
export type ImportState = ContractImportState<ContractImportPreview>

/** One preview or import in flight: the panel scope that started it and whether that panel is still the mounted one. */
export interface ImportOperation {
    readonly scope: string
    readonly isCurrent: () => boolean
}

/** The exact selected native file or pasted text sent to the existing preview/import operations. */
const sourceInputOf = async (state: ImportState) => {
    if (state.source === "file" && state.file !== null)
        return { file: await uploadedFileOf(state.file), ...(state.sheet === null ? {} : { sheet: state.sheet }) }
    return { text: state.paste }
}

/** The state, the reads and the setters the import commands act on. */
export interface ImportCommandsInput {
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

/** What the commands borrow from the world: the words, the settled call, the toast runner and the lead refresh. */
interface ImportRuntime {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly settle: ReturnType<typeof useSettledGraphQL>
    readonly runGraphQL: ReturnType<typeof useGraphQLWithToast>
    readonly revalidate: ReturnType<typeof useRevalidateLeadViews>
}

/** The two server commands of the import. */
interface ImportCommands {
    readonly runPreview: (next: ImportState, mapping: ContractImportMapping | null) => void
    readonly runImport: () => void
}

/** Each named command observes its full tail and keeps only its own preview/import pending origin. */
const importCommandsOf = (input: ImportCommandsInput, runtime: ImportRuntime): ImportCommands => {
    const { state, setState, scope, capture } = input
    const { t, settle, runGraphQL } = runtime
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
    const runImport = (): void => {
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
            await runtime.revalidate()
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

/** The controls of the import view. */
export interface ContractImportActions {
    readonly open: () => void
    readonly close: () => void
    readonly source: (value: string) => void
    readonly file: (files: ReadonlyArray<File>) => void
    readonly paste: (value: string) => void
    readonly sheet: (value: string | null) => void
    readonly preview: () => void
    readonly column: (field: string, column: string | null) => void
    readonly runImport: () => void
}

/** Native file selection and column editing remain the original import controls, not fabricated file metadata. */
const importActionsOf = (
    state: ImportState,
    setState: Dispatch<SetStateAction<ImportState>>,
    commands: ImportCommands,
): ContractImportActions => ({
    open: (): void => setState({ ...CLOSED_CONTRACT_IMPORT, isOpen: true }),
    close: (): void => setState(CLOSED_CONTRACT_IMPORT),
    source: (value: string): void =>
        setState({ ...state, source: value === "paste" ? "paste" : "file", preview: null, mapping: null, error: null }),
    file: (files: ReadonlyArray<File>): void => {
        const [file] = files
        if (file !== undefined) commands.runPreview({ ...state, file, sheet: null, preview: null }, null)
    },
    paste: (value: string): void => setState({ ...state, paste: value }),
    sheet: (value: string | null): void => {
        if (value !== null && state.file !== null) commands.runPreview({ ...state, sheet: value }, null)
    },
    preview: (): void => commands.runPreview({ ...state, preview: null }, null),
    column: (field: string, column: string | null): void => {
        if (state.mapping === null) return
        const known: ContractImportField =
            CONTRACT_IMPORT_FIELDS.find((candidate) => candidate === field) ?? "customerName"
        commands.runPreview(state, { ...state.mapping, [known]: column })
    },
    runImport: commands.runImport,
})

/** The commands and the controls of the import, acting on the state the hook owner holds. */
export const useContractImportActions = (input: ImportCommandsInput): ContractImportActions => {
    const runtime: ImportRuntime = {
        t: useTranslations("workbenchSales"),
        settle: useSettledGraphQL(),
        runGraphQL: useGraphQLWithToast(),
        revalidate: useRevalidateLeadViews(),
    }
    return importActionsOf(input.state, input.setState, importCommandsOf(input, runtime))
}
