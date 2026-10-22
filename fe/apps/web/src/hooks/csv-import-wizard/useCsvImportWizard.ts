"use client"

import { useCsvImportFields } from "./useCsvImportFields"
import { useCsvImportWorkflow } from "./useCsvImportWorkflow"
import { useSetConnectionAgents } from "@/hooks/connections"
import { useCsvImportForm } from "@/hooks/rhf"
import type { AgentOption, WizardNote } from "@/modules/types"
import { useTranslations } from "next-intl"
import {
    CSV_SOURCES,
    tableEntityOf,
    type CsvEntity,
    type CsvImportResult,
    type CsvMapping,
    type CsvPreview,
    type CsvSavedImport,
    type CsvSource,
    type CsvStep,
} from "./csv-import-wizard.shared"
import { useCsvImportCommands } from "./useCsvImportCommands"
import { useCsvImportGrid } from "./useCsvImportGrid"
import { useCsvImportResume } from "./useCsvImportResume"

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

/**
 * The import wizard's state machine: name, kind of rows and source; the data (file, Google Sheets link, typed grid or documents); the
 * column mapping with a preview; the import; the agents that may read it. When resuming it loads the saved import first, then starts
 * on the data step with the saved source, link, columns, schedule and agents.
 */
export const useCsvImportWizard = (input: CsvImportWizardInput) => {
    const t = useTranslations("connectorCsv")
    const resume = useCsvImportResume(input.resumeId)
    const saved = resume.saved
    const commands = useCsvImportCommands()
    const setAgentsOf = useSetConnectionAgents()
    const form = useCsvImportForm()
    const gridState = useCsvImportGrid({ savedColumns: saved === null ? null : saved.config.columns })
    const { fields, patch, name, entity, source, schedule, link, index, steps, connectionId, agentIds, column } =
        useCsvImportFields(input, saved, form)

    const { go, read, runImport, finish, isPending } = useCsvImportWorkflow({
        patch,
        entity,
        connectionId,
        fields,
        t,
        source,
        link,
        gridState,
        commands,
        name,
        schedule,
        input,
        setAgentsOf,
        agentIds,
    })

    return viewOf({
        resume,
        saved,
        index,
        steps,
        input,
        fields,
        name,
        entity,
        schedule,
        link,
        gridState,
        source,
        agentIds,
        isPending,
        go,
        read,
        runImport,
        finish,
        form,
        patch,
        column,
    })
}
/** The resolved inputs for csv import view input. */
interface CsvImportViewInput {
    readonly resume: ReturnType<typeof useCsvImportResume>
    readonly saved: CsvSavedImport | null
    readonly index: number
    readonly steps: readonly CsvStep[]
    readonly input: CsvImportWizardInput
    readonly fields: CsvImportFields
    readonly name: string
    readonly entity: Exclude<CsvEntity, "document">
    readonly schedule: string
    readonly link: string
    readonly gridState: ReturnType<typeof useCsvImportGrid>
    readonly source: CsvSource
    readonly agentIds: readonly string[]
    readonly isPending: boolean
    readonly go: (to: number) => void
    readonly read: (sheet?: string) => Promise<void>
    readonly runImport: () => Promise<void>
    readonly finish: () => Promise<void>
    readonly form: ReturnType<typeof useCsvImportForm>
    readonly patch: (next: Partial<CsvImportFields>) => void
    readonly column: (key: "idColumn" | "titleColumn" | "dateColumn", value: string | null) => void
}

const viewOf = ({
    resume,
    saved,
    index,
    steps,
    input,
    fields,
    name,
    entity,
    schedule,
    link,
    gridState,
    source,
    agentIds,
    isPending,
    go,
    read,
    runImport,
    finish,
    form,
    patch,
    column,
}: CsvImportViewInput) => {
    return {
        isLoading: resume.isLoading,
        loadError: resume.error ?? null,
        saved,
        index,
        steps,
        step: steps[index] ?? "source",
        canGoBack: index > (input.resumeId ? 1 : 0) && fields.result === null,
        form: { name, entity, schedule, link, paste: gridState.paste },
        source,
        grid: gridState.grid,
        file: fields.file,
        docs: fields.docs,
        preview: fields.preview,
        mapping: fields.mapping,
        result: fields.result,
        note: fields.note,
        agentIds,
        isPending,
        on: {
            ...gridState.on,
            go,
            read: () => void read(),
            sheet: (sheet: string) => void read(sheet),
            runImport: () => void runImport(),
            finish: () => void finish(),
            close: () => input.onClose(fields.result !== null),
            name: (value: string) => form.setValue("name", value, { shouldValidate: true }),
            entity: (value: string | null) => {
                const next = tableEntityOf(value ?? "")
                patch({ entity: next })
                if (!input.resumeId) gridState.restart(next)
            },
            source: (value: string) => patch({ source: CSV_SOURCES.find((s) => s === value) ?? "file" }),
            schedule: (value: string | null) => patch({ schedule: value ?? "" }),
            file: (files: ReadonlyArray<File>) => patch({ file: files[0] ?? null, preview: null }),
            link: (value: string) => patch({ link: value }),
            docs: (files: ReadonlyArray<File>) => patch({ docs: files }),
            column,
            agents: (ids: ReadonlyArray<string>) => patch({ agentIds: ids }),
        },
    }
}

/** Runs a chosen source and records the import result. */
