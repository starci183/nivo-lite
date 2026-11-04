"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import type { useSetConnectionAgents } from "@/hooks/connections"
import { MAX_FILE_BYTES, type CsvEntity, type CsvSource } from "./csv-import-wizard.shared"
import type { CsvImportWizardInput, CsvImportFields } from "./useCsvImportWizard"
import type { useTranslations } from "next-intl"
import type { CsvImportCommands, CsvSourceArg } from "./useCsvImportCommands"
import type { useCsvImportGrid } from "./useCsvImportGrid"

/** The resolved inputs for csv import now input. */
interface CsvImportNowInput extends Pick<
    CsvImportWorkflowInput,
    "source" | "fields" | "t" | "commands" | "name" | "connectionId" | "link" | "schedule"
> {
    readonly fail: (text: string) => void
    readonly sourceArg: (sheet?: string) => CsvSourceArg | null
}

/** Builds the command that runs the import of the chosen source, answering what the back end returned. */
const csvImportNowOf =
    ({ source, fields, fail, t, commands, name, connectionId, link, sourceArg, schedule }: CsvImportNowInput) =>
    async () => {
        if (source === "document") {
            if (fields.docs.reduce((sum, doc) => sum + doc.size, 0) > MAX_FILE_BYTES) return fail(t("tooBig"))
            const files = fields.docs
            return commands.runDocuments({ name, ...(connectionId ? { connectionId } : {}), files, link: link.trim() })
        }
        const arg = sourceArg()
        if (!arg || !fields.mapping) return
        const minutes = source === "sheet" && schedule ? Number(schedule) : null
        return commands.runImport(arg, { name, mapping: fields.mapping, schedule: minutes })
    }

/** What the actions of the workflow read besides the pending flag. */
interface CsvImportActionsInput extends Pick<
    CsvImportWorkflowInput,
    "patch" | "entity" | "connectionId" | "fields" | "t" | "source" | "link" | "gridState" | "commands"
> {
    readonly setPending: Dispatch<SetStateAction<boolean>>
}

/** The commands the wizard steps run: report a failure, read the source, move to a step, read a preview. */
interface CsvImportActions {
    fail: (text: string) => void
    sourceArg: (sheet?: string) => CsvSourceArg | null
    go: (to: number) => void
    read: (sheet?: string) => Promise<void>
}

const createCsvImportWizardActions = ({
    patch,
    entity,
    connectionId,
    fields,
    t,
    source,
    link,
    gridState,
    setPending,
    commands,
}: CsvImportActionsInput): CsvImportActions => {
    const fail = (text: string) => patch({ note: { tone: "negative", text } })
    const go = (to: number) => patch({ note: null, index: to })
    const missing = (key: "needFile" | "tooBig" | "needLink" | "needSheetEmpty") => {
        fail(t(key))
        return null
    }

    /* The chosen source as the back end reads it (it parses everything). */
    const sourceArg = (sheet?: string): CsvSourceArg | null => {
        const base = { entity, ...(connectionId ? { connectionId } : {}) }
        const chosenSheet = sheet ?? fields.preview?.sheet
        if (source === "file") {
            if (!fields.file) return missing("needFile")
            if (fields.file.size > MAX_FILE_BYTES) return missing("tooBig")
            return { ...base, kind: "file", file: fields.file, ...(chosenSheet ? { sheet: chosenSheet } : {}) }
        }
        if (source === "sheet") return link.trim() ? { ...base, kind: "sheet", link: link.trim() } : missing("needLink")
        return gridState.hasRows ? { ...base, kind: "grid", grid: gridState.source } : missing("needSheetEmpty")
    }

    const read = async (sheet?: string) => {
        const arg = sourceArg(sheet)
        if (!arg) return
        setPending(true)
        const answer = await commands.preview(arg)
        setPending(false)
        if (answer.kind !== "ok") return fail(answer.message)
        patch({ preview: answer.value, mapping: answer.value.mapping, note: null, index: 2 })
    }
    return { fail, sourceArg, go, read }
}

const createCsvImportRunner =
    (
        setPending: (value: boolean) => void,
        importNow: ReturnType<typeof csvImportNowOf>,
        fail: (message: string) => void,
        patch: (next: Partial<CsvImportFields>) => void,
    ): (() => Promise<void>) =>
    async () => {
        setPending(true)
        const answer = await importNow()
        setPending(false)
        if (answer === undefined) return
        if (answer.kind !== "ok") return fail(answer.message)
        patch({ result: answer.value, note: null })
    }
/** The resolved inputs for csv import workflow input. */
interface CsvImportWorkflowInput {
    readonly patch: (next: Partial<CsvImportFields>) => void
    readonly entity: Exclude<CsvEntity, "document">
    readonly connectionId: string | undefined
    readonly fields: CsvImportFields
    readonly t: ReturnType<typeof useTranslations<"connectorCsv">>
    readonly source: CsvSource
    readonly link: string
    readonly gridState: ReturnType<typeof useCsvImportGrid>
    readonly commands: CsvImportCommands
    readonly name: string
    readonly schedule: string
    readonly input: CsvImportWizardInput
    readonly setAgentsOf: ReturnType<typeof useSetConnectionAgents>
    readonly agentIds: ReadonlyArray<string>
}

/** The view `useCsvImportWorkflow` returns. */
export interface CsvImportWorkflowView {
    go: (to: number) => void
    read: (sheet?: string) => Promise<void>
    runImport: () => Promise<void>
    finish: () => Promise<void>
    isPending: boolean
}

/** Owns preview/import progress and completion of the selected CSV or document source. */
export const useCsvImportWorkflow = ({
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
}: CsvImportWorkflowInput): CsvImportWorkflowView => {
    const [isPending, setPending] = useState(false)
    const { fail, sourceArg, go, read } = createCsvImportWizardActions({
        patch,
        entity,
        connectionId,
        fields,
        t,
        source,
        link,
        gridState,
        setPending,
        commands,
    })
    const importNow = csvImportNowOf({
        source,
        fields,
        fail,
        t,
        commands,
        name,
        connectionId,
        link,
        sourceArg,
        schedule,
    })
    const runImport = createCsvImportRunner(setPending, importNow, fail, patch)
    const finish = async () => {
        const id = fields.result?.connectionId ?? input.resumeId
        if (!id) return input.onClose(false)
        setPending(true)
        const answer = await setAgentsOf(id, agentIds)
        setPending(false)
        if (answer.kind !== "ok") return fail(answer.message)
        input.onClose(true)
    }
    return { go, read, runImport, finish, isPending }
}
