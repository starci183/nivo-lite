"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { allAgentIds } from "@/hooks/connection-wizard"
import { useSetConnectionAgents } from "@/hooks/connections"
import { useCsvImportForm } from "@/hooks/rhf"
import type { AgentOption, WizardNote } from "@/modules/types"
import {
    CSV_SOURCES,
    DOC_STEPS,
    MAX_FILE_BYTES,
    NO_COLUMN,
    TABLE_STEPS,
    tableEntityOf,
} from "./csv-import-wizard.shared"
import type { CsvEntity, CsvImportResult, CsvMapping, CsvPreview, CsvSource } from "./csv-import-wizard.shared"
import { useCsvImportCommands } from "./useCsvImportCommands"
import type { CsvSourceArg } from "./useCsvImportCommands"
import { useCsvImportGrid } from "./useCsvImportGrid"
import { useCsvImportResume } from "./useCsvImportResume"

/** What the import wizard needs from its drawer. */
interface CsvImportWizardInput {
    readonly agents: ReadonlyArray<AgentOption>
    /** Add more data to this existing import instead of creating a new one. */
    readonly resumeId?: string
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** The wizard's own state; a field left undefined still follows the saved import (or the default of a new one). */
interface CsvImportFields {
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

const START: CsvImportFields = { file: null, docs: [], preview: null, mapping: null, result: null, note: null }

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
    const [fields, setFields] = useState<CsvImportFields>(START)
    const [isPending, setPending] = useState(false)
    const patch = (next: Partial<CsvImportFields>) => setFields((current) => ({ ...current, ...next }))

    const name = form.watch("name")
    const savedEntity = saved && saved.config.entity !== "document" ? saved.config.entity : "customer"
    const entity = fields.entity ?? savedEntity
    const source = fields.source ?? saved?.config.source ?? "file"
    const schedule = fields.schedule ?? (saved?.scheduleMinutes ? String(saved.scheduleMinutes) : "")
    const link = fields.link ?? saved?.config.link ?? ""
    const index = fields.index ?? (saved ? 1 : 0)
    const steps = source === "document" ? DOC_STEPS : TABLE_STEPS
    const connectionId = input.resumeId ?? fields.result?.connectionId
    const fail = (text: string) => patch({ note: { tone: "negative", text } })
    const go = (to: number) => patch({ note: null, index: to })

    /* The chosen source as the back end reads it (it parses everything). */
    const sourceArg = (sheet?: string): CsvSourceArg | null => {
        const base = { entity, ...(connectionId ? { connectionId } : {}) }
        const chosenSheet = sheet ?? fields.preview?.sheet
        const missing = (key: "needFile" | "tooBig" | "needLink" | "needSheetEmpty") => {
            fail(t(key))
            return null
        }
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

    const importNow = async () => {
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

    const runImport = async () => {
        setPending(true)
        const answer = await importNow()
        setPending(false)
        if (answer === undefined) return
        if (answer.kind !== "ok") return fail(answer.message)
        patch({ result: answer.value, note: null })
    }

    const agentIds = fields.agentIds ?? (saved?.agentIds.length ? saved.agentIds : allAgentIds(input.agents))

    const finish = async () => {
        const id = fields.result?.connectionId ?? input.resumeId
        if (!id) return input.onClose(false)
        setPending(true)
        const answer = await setAgentsOf(id, agentIds)
        setPending(false)
        if (answer.kind !== "ok") return fail(answer.message)
        input.onClose(true)
    }

    const column = (key: "idColumn" | "titleColumn" | "dateColumn", value: string | null) => {
        if (fields.mapping)
            patch({ mapping: { ...fields.mapping, [key]: !value || value === NO_COLUMN ? null : value } })
    }

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
