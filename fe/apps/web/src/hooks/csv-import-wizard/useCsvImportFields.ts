"use client"

import { allAgentIds } from "@/hooks/connection-wizard"
import { useCsvImportForm } from "@/hooks/rhf"
import { useState } from "react"
import { DOC_STEPS, NO_COLUMN, TABLE_STEPS, type CsvSavedImport } from "./csv-import-wizard.shared"
import type { CsvImportFields, CsvImportWizardInput } from "./useCsvImportWizard"

const START: CsvImportFields = { file: null, docs: [], preview: null, mapping: null, result: null, note: null }

/** Owns the editable import draft and derives its current source, mapping and agents. */
export const useCsvImportFields = (
    input: CsvImportWizardInput,
    saved: CsvSavedImport | null,
    form: ReturnType<typeof useCsvImportForm>,
) => {
    const [fields, setFields] = useState<CsvImportFields>(START)

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

    const agentIds = fields.agentIds ?? (saved?.agentIds.length ? saved.agentIds : allAgentIds(input.agents))

    const column = (key: "idColumn" | "titleColumn" | "dateColumn", value: string | null) => {
        if (fields.mapping)
            patch({ mapping: { ...fields.mapping, [key]: !value || value === NO_COLUMN ? null : value } })
    }
    return { fields, patch, name, entity, source, schedule, link, index, steps, connectionId, agentIds, column }
}
