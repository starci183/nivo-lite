"use client"

import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateRunCsvImportSwr, useMutateRunDocumentImportSwr, useQueryPreviewCsvSourceSwr } from "@/hooks/swr"
import { useMemo } from "react"
import { parseMapping, uploadedFileOf } from "./csv-import-wizard.shared"
import type { CsvImportResult, CsvMapping, CsvPreview } from "./csv-import-wizard.shared"

/** The rows typed or pasted into the grid. */
export interface CsvGridSource {
    readonly headers: ReadonlyArray<string>
    readonly rows: ReadonlyArray<ReadonlyArray<string>>
}

/** Which source to read and where it goes. */
export interface CsvSourceArg {
    readonly kind: "file" | "sheet" | "grid"
    readonly entity: string
    readonly connectionId?: string
    readonly file?: File
    readonly sheet?: string
    readonly link?: string
    readonly grid?: CsvGridSource
}

/** What a table import takes besides the source. */
export interface CsvImportArg {
    readonly name: string
    readonly mapping: CsvMapping
    readonly schedule: number | null
}

/** What a documents import takes. */
export interface DocumentImportArg {
    readonly name: string
    readonly connectionId?: string
    readonly files: ReadonlyArray<File>
    readonly link: string
}

/** The GraphQL operations of the CSV, Excel and document import wizard (the active workspace travels in the request header). */
export interface CsvImportCommands {
    readonly preview: (source: CsvSourceArg) => Promise<Settled<CsvPreview>>
    readonly runImport: (source: CsvSourceArg, form: CsvImportArg) => Promise<Settled<CsvImportResult>>
    readonly runDocuments: (form: DocumentImportArg) => Promise<Settled<CsvImportResult>>
}

const sourceInput = async (source: CsvSourceArg) => ({
    kind: source.kind,
    entity: source.entity,
    connectionId: source.connectionId,
    sheet: source.sheet,
    link: source.link,
    grid: source.grid === undefined ? undefined : { headers: source.grid.headers, rows: source.grid.rows },
    file: source.file === undefined ? undefined : await uploadedFileOf(source.file),
})

/** The import wizard's preview and import operations bound to the toast helper. */
export const useCsvImportCommands = (): CsvImportCommands => {
    const settle = useSettledGraphQL()
    const { trigger: previewSource } = useQueryPreviewCsvSourceSwr()
    const refresh = useConnectionsRefresh()
    const { trigger: triggerImport } = useMutateRunCsvImportSwr()
    const { trigger: triggerDocuments } = useMutateRunDocumentImportSwr()
    return useMemo(
        () => ({
            preview: async (source) => {
                const settled = await settle(async () => {
                    return previewSource(await sourceInput(source))
                })
                if (settled.kind !== "ok") return settled
                const { mapping, ...rest } = settled.value
                return { kind: "ok", value: { ...rest, mapping: parseMapping(mapping) } }
            },
            runImport: async (source, form) => {
                const settled = await settle(async () =>
                    triggerImport({
                        ...(await sourceInput(source)),
                        name: form.name,
                        mapping: form.mapping,
                        schedule: form.schedule,
                    }),
                )
                if (settled.kind !== "ok") return settled
                await refresh()
                return settled
            },
            runDocuments: async (form) => {
                const settled = await settle(async () =>
                    triggerDocuments({
                        connectionId: form.connectionId,
                        name: form.name,
                        link: form.link,
                        files: await Promise.all(form.files.map(uploadedFileOf)),
                    }),
                )
                if (settled.kind !== "ok") return settled
                await refresh()
                return settled
            },
        }),
        [settle, refresh, triggerImport, triggerDocuments, previewSource],
    )
}
