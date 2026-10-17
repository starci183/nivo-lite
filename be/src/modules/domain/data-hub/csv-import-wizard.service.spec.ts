import { Test } from "@nestjs/testing"
import { fakeTransaction, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import { DataRecordsService } from "@modules/domain/data-records"
import { DataSyncRunsService } from "@modules/domain/data-sync-runs"
import type { DataSyncRun } from "@modules/domain/data-sync-runs"
import type { Table, TableClient } from "@modules/integrations/data-sources"
import { TABLE } from "@modules/integrations/data-sources"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { CsvConfig, CsvImportRequest } from "./csv-import.contracts"
import { CsvImportWizardService } from "./csv-import-wizard.service"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { CSV_COPY } from "./messages/csv-import.messages"

const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "workspace-1" }

const config: CsvConfig = {
    v: 1,
    source: "manual",
    entity: "customer",
    idColumn: "id",
    titleColumn: "name",
    dateColumn: null,
    kinds: { id: "text", name: "text" },
    columns: ["id", "name"],
}

const documentsConfig: CsvConfig = {
    ...config,
    source: "document",
    entity: "document",
    idColumn: null,
    titleColumn: null,
    dateColumn: null,
    kinds: {},
    columns: [],
}

const uploadRun: DataSyncRun = {
    id: "run-1",
    connectionId: "connection-1",
    trigger: "upload",
    state: "running",
    rows: 0,
    error: null,
    startedAt: "2026-10-14T00:00:00.000Z",
    finishedAt: null,
}

const source: Table = {
    headers: ["id", "name"],
    rows: [
        ["customer-1", "Alice"],
        ["customer-2", "Bob"],
        ["", "Missing id"],
    ],
    sheets: [],
    sheet: "",
    delimiter: ",",
}

const connection: DataConnection = {
    id: "connection-1",
    workspaceId: "workspace-1",
    provider: "csv_import",
    name: "Customers",
    status: "connected",
    lastError: null,
    meta: { config: JSON.stringify(config), file: "customers.csv", summary: "Saved summary" },
    everyMinutes: null,
    lastSyncAt: null,
}

const request: CsvImportRequest = {
    kind: "paste",
    entity: "customer",
    name: "  Customers  ",
    text: "id,name\ncustomer-1,Alice",
    mapping: config,
}

const recordsToWrite = [
    { externalId: "customer-1", title: "Alice", occurredAt: null, data: { id: "customer-1", name: "Alice" } },
    { externalId: "customer-2", title: "Bob", occurredAt: null, data: { id: "customer-2", name: "Bob" } },
]

const customerSummary = `${CSV_COPY.entity.customer} \u00b7 2 ${CSV_COPY.rowUnit}`

const documentSummary = `${CSV_COPY.entity.document} \u00b7 2 ${CSV_COPY.documentUnit}`

const build = async () => {
    const transaction = fakeTransaction()
    const hub = mock<DataHubService>()
    const connections = mock<ConnectionsService>()
    const records = mock<DataRecordsService>()
    const runs = mock<DataSyncRunsService>()
    const table = mock<TableClient>()
    hub.own.mockResolvedValue(connection)
    hub.create.mockResolvedValue("connection-1")
    hub.agentIds.mockResolvedValue(["agent-1"])
    records.upsert.mockResolvedValue(2)
    records.count.mockResolvedValue(2)
    records.countExisting.mockResolvedValue(1)
    runs.open.mockResolvedValue(null)
    table.readText.mockReturnValue(source)
    table.readGrid.mockReturnValue(source)
    table.readFile.mockResolvedValue(source)
    table.readSheetLink.mockResolvedValue(source)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CsvImportWizardService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: transaction.em },
            { provide: DataHubService, useValue: hub },
            { provide: ConnectionsService, useValue: connections },
            { provide: DataRecordsService, useValue: records },
            { provide: DataSyncRunsService, useValue: runs },
            { provide: TABLE, useValue: table },
        ],
    }).compile()
    return { service: moduleRef.get(CsvImportWizardService), transaction, hub, connections, records, runs, table }
}

describe("CsvImportWizardService", () => {
    it("loads a saved import with its grants and schedule after checking the owner", async () => {
        const { service, hub } = await build()

        await expect(service.load(actor, "connection-1")).resolves.toEqual({
            name: "Customers",
            config,
            file: "customers.csv",
            summary: "Saved summary",
            agentIds: ["agent-1"],
            scheduleMinutes: null,
        })
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "connection-1", "csv_import")
        expect(hub.agentIds).toHaveBeenCalledWith("workspace-1", "connection-1")
        hub.own.mockResolvedValue({ ...connection, everyMinutes: 60, meta: { config: JSON.stringify(config) } })
        await expect(service.load(actor, "connection-1")).resolves.toMatchObject({
            file: "",
            summary: "",
            scheduleMinutes: 60,
        })
    })

    it("refuses a saved import whose configuration is missing", async () => {
        const { service, hub } = await build()
        hub.own.mockResolvedValue({ ...connection, meta: {} })

        await expect(service.load(actor, "connection-1")).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: CSV_COPY.noSavedSetup },
        })
        expect(hub.agentIds).not.toHaveBeenCalled()
    })

    it("previews pasted rows with an exact suggested mapping", async () => {
        const { service, table } = await build()

        await expect(service.preview(actor, request)).resolves.toEqual({
            headers: ["id", "name"],
            sample: source.rows,
            total: 3,
            sheets: [],
            sheet: "",
            delimiter: ",",
            mapping: {
                idColumn: "id",
                titleColumn: "name",
                dateColumn: null,
                kinds: { id: "text", name: "text" },
                columns: ["id", "name"],
            },
            missing: [],
        })
        expect(table.readText).toHaveBeenCalledWith("id,name\ncustomer-1,Alice")
    })
})

describe("CsvImportWizardService", () => {
    it("carries a saved mapping and reports columns missing from a re-upload", async () => {
        const { service, hub, table } = await build()
        const saved: CsvConfig = { ...config, titleColumn: "full_name", kinds: { id: "text", name: "email" } }
        hub.own.mockResolvedValue({ ...connection, meta: { config: JSON.stringify(saved) } })

        await expect(
            service.preview(actor, {
                kind: "grid",
                connectionId: "connection-1",
                grid: { headers: ["id", "name"], rows: [[1, true]] },
            }),
        ).resolves.toEqual({
            headers: ["id", "name"],
            sample: source.rows,
            total: 3,
            sheets: [],
            sheet: "",
            delimiter: ",",
            mapping: {
                idColumn: "id",
                titleColumn: "name",
                dateColumn: null,
                kinds: { id: "text", name: "email" },
                columns: ["id", "name"],
            },
            missing: ["full_name"],
        })
        expect(table.readGrid).toHaveBeenCalledWith(["id", "name"], [["1", "true"]])
    })

    it("decodes an uploaded table and forwards its selected sheet", async () => {
        const { service, table } = await build()
        const file = { name: "customers.xlsx", contentBase64: "YWJj" }

        await service.preview(actor, { kind: "file", entity: "customer", file, sheet: "Customers" })

        expect(table.readFile).toHaveBeenCalledWith("customers.xlsx", Buffer.from("abc"), "Customers")
        await service.preview(actor, { kind: "file", entity: "customer", file })
        expect(table.readFile).toHaveBeenCalledWith("customers.xlsx", Buffer.from("abc"), undefined)
    })

    it("does not read a source when the caller fails the owner check", async () => {
        const { service, hub, table } = await build()
        const cause = new Error("owner required")
        hub.owner.mockRejectedValue(cause)
        await expect(service.preview(actor, request)).rejects.toBe(cause)
        expect(table.readText).not.toHaveBeenCalled()
    })
})

describe("CsvImportWizardService", () => {
    it("creates a manual import, writes mapped rows and settles its upload run", async () => {
        const { service, hub, records, runs, connections, transaction } = await build()
        runs.open.mockResolvedValue(uploadRun)
        await expect(service.importTable(actor, request)).resolves.toEqual({
            connectionId: "connection-1",
            added: 2,
            updated: 0,
            skipped: 1,
            total: 2,
            summary: customerSummary,
        })
        expect(hub.create).toHaveBeenCalledWith(actor, {
            provider: "csv_import",
            name: "Customers",
            meta: { config: JSON.stringify(config), summary: "", file: CSV_COPY.manualLabel },
            credential: "{}",
            everyMinutes: null,
        })
        expect(records.upsert).toHaveBeenCalledWith("workspace-1", "connection-1", "customer", recordsToWrite)
        expect(records.countExisting).not.toHaveBeenCalled()
        expect(records.count).toHaveBeenCalledWith("connection-1")
        expect(connections.markSynced).toHaveBeenCalledWith("connection-1", {
            config: JSON.stringify(config),
            summary: customerSummary,
            file: CSV_COPY.manualLabel,
        })
        expect(runs.finish).toHaveBeenCalledWith("run-1", "ok", 2, null)
        expect(transaction.commits).toBe(1)
    })
    it("updates existing sheet rows and changes their schedule", async () => {
        const { service, hub, records, connections, table } = await build()
        const saved: CsvConfig = { ...config, source: "sheet", link: "https://docs.google.com/spreadsheets/d/sheet-1" }
        hub.own.mockResolvedValue({ ...connection, meta: { config: JSON.stringify(saved) } })
        await expect(
            service.importTable(actor, {
                ...request,
                kind: "sheet",
                connectionId: "connection-1",
                link: " https://docs.google.com/spreadsheets/d/sheet-1 ",
                schedule: 360,
            }),
        ).resolves.toEqual({
            connectionId: "connection-1",
            added: 1,
            updated: 1,
            skipped: 1,
            total: 2,
            summary: customerSummary,
        })
        expect(table.readSheetLink).toHaveBeenCalledWith("https://docs.google.com/spreadsheets/d/sheet-1")
        expect(hub.create).not.toHaveBeenCalled()
        expect(records.countExisting).toHaveBeenCalledWith("connection-1", "customer", ["customer-1", "customer-2"])
        expect(connections.setSchedule).toHaveBeenCalledWith("workspace-1", "connection-1", 360)
        expect(connections.markSynced).toHaveBeenCalledWith("connection-1", {
            config: JSON.stringify(saved),
            summary: customerSummary,
            file: "Google Sheets",
        })
    })
    it("refuses an unsupported sheet schedule before creating an import", async () => {
        const { service, hub } = await build()
        await expect(
            service.importTable(actor, { ...request, kind: "sheet", link: "https://example.com/sheet", schedule: 15 }),
        ).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: CSV_COPY.scheduleInvalid } })
        expect(hub.create).not.toHaveBeenCalled()
    })
})

describe("CsvImportWizardService", () => {
    it("refuses a re-upload from a different source", async () => {
        const { service, records } = await build()
        await expect(
            service.importTable(actor, {
                ...request,
                kind: "sheet",
                connectionId: "connection-1",
                link: "https://example.com/sheet",
            }),
        ).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: CSV_COPY.otherSource } })
        expect(records.upsert).not.toHaveBeenCalled()
    })
    it("refuses a table with no usable ids before creating an import", async () => {
        const { service, table, hub } = await build()
        table.readText.mockReturnValue({ ...source, rows: [["", "Missing id"]] })
        await expect(service.importTable(actor, request)).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: CSV_COPY.noRows },
        })
        expect(hub.create).not.toHaveBeenCalled()
    })
})

describe("CsvImportWizardService", () => {
    it("imports uploaded documents and a Google Doc as exact document records", async () => {
        const { service, table, records, hub } = await build()
        table.readDocumentFile.mockResolvedValue({ text: "# Uploaded\nBody", pages: 2 })
        table.readDocumentLink.mockResolvedValue({ id: "document-1", text: "# Linked\nBody" })
        const files = [{ name: "guide.pdf", contentBase64: "YWJj" }]
        const uploadedRecord = {
            externalId: "guide.pdf",
            title: "Uploaded",
            data: { text: "# Uploaded\nBody", source: "upload", fileName: "guide.pdf", pages: 2 },
        }
        const documentLink = "https://docs.google.com/document/d/document-1"
        const documentConfig: CsvConfig = { ...documentsConfig, link: documentLink }
        await expect(
            service.importDocuments(actor, {
                name: "Documents",
                files,
                link: " https://docs.google.com/document/d/document-1 ",
            }),
        ).resolves.toEqual({
            connectionId: "connection-1",
            added: 2,
            updated: 0,
            skipped: 0,
            total: 2,
            summary: documentSummary,
        })
        expect(table.readDocumentFile).toHaveBeenCalledWith("guide.pdf", Buffer.from("abc"))
        expect(table.readDocumentLink).toHaveBeenCalledWith("https://docs.google.com/document/d/document-1")
        expect(records.upsert).toHaveBeenCalledWith("workspace-1", "connection-1", "document", [
            uploadedRecord,
            {
                externalId: "document-1",
                title: "Linked",
                data: { text: "# Linked\nBody", source: "google_docs", docId: "document-1" },
            },
        ])
        expect(hub.create).toHaveBeenCalledWith(actor, {
            provider: "csv_import",
            name: "Documents",
            meta: { config: JSON.stringify(documentConfig), summary: "", file: "guide.pdf, Google Docs" },
            credential: "{}",
            everyMinutes: null,
        })
        await service.importDocuments(actor, { name: "Documents", files })
        expect(records.upsert).toHaveBeenLastCalledWith("workspace-1", "connection-1", "document", [uploadedRecord])
        expect(hub.create).toHaveBeenLastCalledWith(actor, {
            provider: "csv_import",
            name: "Documents",
            meta: { config: JSON.stringify(documentsConfig), summary: "", file: "guide.pdf" },
            credential: "{}",
            everyMinutes: null,
        })
        expect(table.readDocumentLink).toHaveBeenCalledTimes(1)
    })
    it("refuses documents added to an existing table import", async () => {
        const { service, table, hub } = await build()
        const documentError = { code: DataHubErrorCode.Invalid, params: { detail: CSV_COPY.notDocumentImport } }
        await expect(
            service.importDocuments(actor, {
                connectionId: "connection-1",
                files: [{ name: "guide.txt", contentBase64: "YWJj" }],
            }),
        ).rejects.toMatchObject(documentError)
        expect(table.readDocumentFile).not.toHaveBeenCalled()
        hub.own.mockResolvedValue({ ...connection, meta: { config: "damaged" } })
        await expect(service.importDocuments(actor, { connectionId: "connection-1" })).rejects.toMatchObject(
            documentError,
        )
    })
})

describe("CsvImportWizardService", () => {
    it("removes a newly created connection after the first write fails", async () => {
        const { service, records, hub, connections } = await build()
        const cause = new Error("write failed")
        records.upsert.mockRejectedValue(cause)
        await expect(service.importTable(actor, request)).rejects.toBe(cause)
        expect(hub.remove).toHaveBeenCalledWith("workspace-1", "connection-1")
        expect(connections.markSynced).not.toHaveBeenCalled()
    })
    it("keeps an existing connection and marks its upload run failed", async () => {
        const { service, records, hub, runs } = await build()
        const cause = new Error("write failed")
        records.upsert.mockRejectedValue(cause)
        runs.open.mockResolvedValue(uploadRun)
        await expect(service.importTable(actor, { ...request, connectionId: "connection-1" })).rejects.toBe(cause)
        expect(hub.remove).not.toHaveBeenCalled()
        expect(runs.finish).toHaveBeenCalledWith("run-1", "failed", 0, "Error: write failed")
    })
    it("refuses an unknown source, an empty file, and a re-upload with no saved setup", async () => {
        const { service, table, hub } = await build()
        await expect(service.preview(actor, { kind: "other", entity: "customer" })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: CSV_COPY.invalidSource },
        })
        await expect(
            service.preview(actor, { kind: "file", entity: "customer", file: { name: "a.csv", contentBase64: "" } }),
        ).rejects.toMatchObject({ params: { detail: CSV_COPY.chooseFile } })
        expect(table.readFile).not.toHaveBeenCalled()
        await service.preview(actor, {
            kind: "file",
            entity: "customer",
            file: { name: "customers.xlsx", contentBase64: "YWJj" },
            sheet: "",
        })
        expect(table.readFile).toHaveBeenCalledWith("customers.xlsx", Buffer.from("abc"), undefined)
        hub.own.mockResolvedValue({ ...connection, meta: {} })
        await expect(service.importTable(actor, { ...request, connectionId: "connection-1" })).rejects.toMatchObject({
            params: { detail: CSV_COPY.noSavedSetup },
        })
    })
    it("creates a sheet import on the named tab with a manual schedule", async () => {
        const { service, hub, table } = await build()
        table.readSheetLink.mockResolvedValue({ ...source, sheet: "Customers" })
        const sheetRequest: CsvImportRequest = {
            kind: "sheet",
            entity: "customer",
            name: "Customers",
            link: "https://docs.google.com/spreadsheets/d/sheet-1",
            mapping: config,
        }
        await service.importTable(actor, sheetRequest)
        expect(hub.create).toHaveBeenCalledWith(
            actor,
            expect.objectContaining({
                everyMinutes: null,
                meta: expect.objectContaining({
                    config: expect.stringContaining('"sheet":"Customers"'),
                }),
            }),
        )
        await service.preview(actor, { kind: "sheet", entity: "customer" })
        expect(table.readSheetLink).toHaveBeenCalledWith("")
        await service.importTable(actor, { ...sheetRequest, schedule: 1440 })
        expect(hub.create).toHaveBeenLastCalledWith(actor, expect.objectContaining({ everyMinutes: 1440 }))
    })
})

describe("CsvImportWizardService", () => {
    it("adds documents to a saved document import and ignores an empty upload", async () => {
        const { service, hub, table, records } = await build()
        hub.own.mockResolvedValue({ ...connection, meta: { config: JSON.stringify(documentsConfig) } })
        table.readDocumentLink.mockResolvedValue({ id: "document-1", text: "# Linked\nBody" })
        await expect(
            service.importDocuments(actor, {
                connectionId: "connection-1",
                files: [{ name: "empty.txt", contentBase64: "" }],
                link: "https://docs.google.com/document/d/document-1",
            }),
        ).resolves.toMatchObject({ connectionId: "connection-1", skipped: 0 })
        expect(table.readDocumentFile).not.toHaveBeenCalled()
        expect(records.upsert).toHaveBeenCalledWith("workspace-1", "connection-1", "document", [
            expect.objectContaining({ externalId: "document-1" }),
        ])
        expect(hub.create).not.toHaveBeenCalled()
    })
    it("refuses a document import with nothing to read", async () => {
        const { service } = await build()
        await expect(service.importDocuments(actor, { name: "Docs" })).rejects.toMatchObject({
            params: { detail: CSV_COPY.chooseDocuments },
        })
    })
    it("keeps an existing import when the upload run was not opened and the write fails", async () => {
        const { service, records, hub, runs } = await build()
        records.upsert.mockRejectedValue("write failed")
        await expect(service.importTable(actor, { ...request, connectionId: "connection-1" })).rejects.toBe(
            "write failed",
        )
        expect(hub.remove).not.toHaveBeenCalled()
        expect(runs.finish).not.toHaveBeenCalled()
    })
})
