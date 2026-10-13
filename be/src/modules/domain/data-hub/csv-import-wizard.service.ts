import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import { InjectTable } from "@modules/integrations/data-sources"
import type { Table, TableClient } from "@modules/integrations/data-sources"
import type { DataRecordInput } from "./data-hub.contracts"
import { CSV_COPY } from "./messages/csv-import.messages"
import { DataHubService } from "./data-hub.service"
import { DataRecordsService } from "./data-records.service"
import { CSV_MAX_DOCUMENT_FILES } from "./csv-import.contracts"
import type {
    CsvConfig,
    CsvEntity,
    CsvImportRequest,
    CsvImportResult,
    CsvMapping,
    CsvPreview,
    CsvSavedImport,
    CsvSourceRequest,
    DocumentImportRequest,
} from "./csv-import.contracts"
import {
    cleanImportName,
    cleanMapping,
    invalid,
    isSchedule,
    mappingOf,
    missingColumns,
    readConfig,
    summaryOf,
    tableEntityOf,
} from "./csv-import-config.policy"
import { carryMapping, suggestMapping } from "./csv-import-mapping.policy"
import { buildRecords, recordFromDocument, recordFromGoogleDoc } from "./csv-import-records.policy"
import { decodeUpload, gridOf, pastedText } from "./csv-import-source.policy"

const PROVIDER = "csv_import" as const
const SAMPLE_ROWS = 10
const FILE_LABEL_MAX = 200

interface ReadSource {
    readonly table: Table
    readonly kind: "file" | "sheet" | "manual"
    readonly label: string
    readonly link?: string
}

interface CommitInput {
    readonly connectionId: string | null
    readonly name: string
    readonly config: CsvConfig
    readonly records: ReadonlyArray<DataRecordInput>
    readonly skipped: number
    readonly file: string
    /** The new schedule in minutes (null is manual); undefined keeps the saved one. */
    readonly schedule?: number | null
}

@Injectable()
/** The wizard operations of the Excel, CSV and document imports: preview a source, import it, read a saved import back. */
export class CsvImportWizardService {
    constructor(
        private readonly hub: DataHubService,
        private readonly connections: ConnectionsService,
        private readonly records: DataRecordsService,
        @InjectTable() private readonly table: TableClient,
    ) {}

    /** The saved setup of one import (to upload again into it). */
    async load(actor: ConnectionActor, connectionId: string): Promise<CsvSavedImport> {
        await this.hub.owner(actor)
        const connection = await this.hub.own(actor.workspaceId, connectionId, PROVIDER)
        const config = readConfig(connection.meta)
        if (config === null) throw invalid(CSV_COPY.noSavedSetup)
        return {
            name: connection.name,
            config,
            file: connection.meta.file ?? "",
            summary: connection.meta.summary ?? "",
            agentIds: await this.hub.agentIds(actor.workspaceId, connectionId),
            scheduleMinutes: connection.everyMinutes,
        }
    }

    /** Reads the chosen source and answers its headers, the first rows, the row count and a suggested mapping (the saved one for a re-upload). */
    async preview(actor: ConnectionActor, request: CsvSourceRequest): Promise<CsvPreview> {
        await this.hub.owner(actor)
        const saved = await this.savedOf(actor.workspaceId, request.connectionId ?? null)
        const entity: CsvEntity = saved === null ? tableEntityOf(request.entity) : saved.entity
        const { table } = await this.readSource(request)
        let mapping: CsvMapping = suggestMapping(table, entity)
        let missing: ReadonlyArray<string> = []
        if (saved !== null) {
            missing = missingColumns(saved, table.headers)
            mapping = carryMapping(saved, table)
        }
        return {
            headers: table.headers,
            sample: table.rows.slice(0, SAMPLE_ROWS),
            total: table.rows.length,
            sheets: table.sheets,
            sheet: table.sheet,
            delimiter: table.delimiter,
            mapping,
            missing,
        }
    }

    /** Imports a table source (file, Google Sheets link, pasted or typed rows) with the chosen mapping. */
    async importTable(actor: ConnectionActor, request: CsvImportRequest): Promise<CsvImportResult> {
        await this.hub.owner(actor)
        const existing = request.connectionId ?? null
        const saved = await this.savedOf(actor.workspaceId, existing)
        if (existing !== null && saved === null) throw invalid(CSV_COPY.noSavedSetup)
        const entity = saved === null ? tableEntityOf(request.entity) : saved.entity
        const name = saved === null ? cleanImportName(request.name) : ""
        const { table, kind, label, link } = await this.readSource(request)
        const mapping = cleanMapping(request.mapping, table.headers)
        const schedule = kind === "sheet" ? (request.schedule ?? null) : undefined
        if (schedule !== undefined && !isSchedule(schedule)) throw invalid(CSV_COPY.scheduleInvalid)
        const config: CsvConfig = {
            v: 1,
            source: kind,
            entity,
            ...mapping,
            ...(table.sheet === "" ? {} : { sheet: table.sheet }),
            ...(link === undefined ? {} : { link }),
        }
        if (saved !== null && saved.source !== config.source) {
            throw invalid(CSV_COPY.otherSource)
        }
        const built = buildRecords(table, mappingOf(config))
        if (built.records.length === 0) throw invalid(CSV_COPY.noRows)
        return this.commit(actor, {
            connectionId: existing,
            name,
            config,
            records: built.records,
            skipped: built.skipped,
            file: label,
            ...(schedule === undefined ? {} : { schedule }),
        })
    }

    /** Imports documents: uploaded .docx .pdf .txt .md files and/or one Google Docs link, as `document` rows. */
    async importDocuments(actor: ConnectionActor, request: DocumentImportRequest): Promise<CsvImportResult> {
        await this.hub.owner(actor)
        const existing = request.connectionId ?? null
        const saved = await this.savedOf(actor.workspaceId, existing)
        if (existing !== null && saved?.source !== "document") {
            throw invalid(CSV_COPY.notDocumentImport)
        }
        const name = saved === null ? cleanImportName(request.name) : ""
        const files = (request.files ?? []).slice(0, CSV_MAX_DOCUMENT_FILES).flatMap((file) => decodeUpload(file) ?? [])
        const link = (request.link ?? "").trim()
        if (files.length === 0 && link === "") {
            throw invalid(CSV_COPY.chooseDocuments)
        }
        const records: Array<DataRecordInput> = await Promise.all(
            files.map(async (file) =>
                recordFromDocument(file.name, await this.table.readDocumentFile(file.name, file.bytes)),
            ),
        )
        if (link !== "") {
            const document = await this.table.readDocumentLink(link)
            records.push(recordFromGoogleDoc(document.id, document.text))
        }
        const config: CsvConfig = {
            v: 1,
            source: "document",
            entity: "document",
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
            kinds: {},
            columns: [],
            ...(link === "" ? {} : { link }),
        }
        const label = [...files.map((file) => file.name), ...(link === "" ? [] : [CSV_COPY.docsLabel])]
            .join(", ")
            .slice(0, FILE_LABEL_MAX)
        return this.commit(actor, {
            connectionId: existing,
            name,
            config,
            records,
            skipped: 0,
            file: label,
        })
    }

    private async savedOf(workspaceId: string, connectionId: string | null): Promise<CsvConfig | null> {
        if (connectionId === null) return null
        const connection = await this.hub.own(workspaceId, connectionId, PROVIDER)
        return readConfig(connection.meta)
    }

    /** The table of the chosen source: file, sheet (Google Sheets link), paste (text copied from Excel) or grid (rows typed in). */
    private async readSource(request: CsvSourceRequest): Promise<ReadSource> {
        if (request.kind === "file") {
            const file = decodeUpload(request.file)
            if (file === null) throw invalid(CSV_COPY.chooseFile)
            const sheet = (request.sheet ?? "").slice(0, 200)
            return {
                table: await this.table.readFile(file.name, file.bytes, sheet === "" ? undefined : sheet),
                kind: "file",
                label: file.name,
            }
        }
        if (request.kind === "sheet") {
            const link = (request.link ?? "").trim().slice(0, 600)
            return { table: await this.table.readSheetLink(link), kind: "sheet", label: CSV_COPY.sheetsLabel, link }
        }
        if (request.kind === "paste") {
            return { table: this.table.readText(pastedText(request.text)), kind: "manual", label: CSV_COPY.manualLabel }
        }
        if (request.kind === "grid") {
            const grid = gridOf(request.grid)
            return { table: this.table.readGrid(grid.headers, grid.rows), kind: "manual", label: CSV_COPY.manualLabel }
        }
        throw invalid(CSV_COPY.invalidSource)
    }

    /** Writes the rows (insert or update by external id) into a new or an existing import and marks it synced; a failed first import leaves no connection behind. */
    private async commit(actor: ConnectionActor, input: CommitInput): Promise<CsvImportResult> {
        const { workspaceId } = actor
        const { config } = input
        const label = input.file.slice(0, FILE_LABEL_MAX)
        let connectionId = input.connectionId
        let created = false
        if (connectionId === null) {
            connectionId = await this.hub.create(actor, {
                provider: PROVIDER,
                name: input.name,
                meta: { config: JSON.stringify(config), summary: "", file: label },
                credential: "{}",
                everyMinutes: config.source === "sheet" ? (input.schedule ?? null) : null,
            })
            created = true
        } else {
            await this.hub.own(workspaceId, connectionId, PROVIDER)
        }
        try {
            const updated = created
                ? 0
                : await this.records.countExisting(
                      connectionId,
                      config.entity,
                      input.records.map((record) => record.externalId),
                  )
            const written = await this.records.upsert(workspaceId, connectionId, config.entity, input.records)
            const total = await this.records.count(connectionId)
            const summary = summaryOf(config.entity, total)
            if (!created && config.source === "sheet" && input.schedule !== undefined) {
                await this.connections.setSchedule(workspaceId, connectionId, input.schedule)
            }
            await this.connections.markSynced(connectionId, {
                config: JSON.stringify(config),
                summary,
                file: label,
            })
            return { connectionId, added: written - updated, updated, skipped: input.skipped, total, summary }
        } catch (cause) {
            if (created) await this.hub.remove(workspaceId, connectionId)
            throw cause
        }
    }
}
