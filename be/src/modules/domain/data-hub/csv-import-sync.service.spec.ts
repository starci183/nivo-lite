import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DataRecordsService } from "@modules/domain/data-records"
import type { Table, TableClient } from "@modules/integrations/data-sources"
import { TABLE } from "@modules/integrations/data-sources"
import type { CsvConfig } from "./csv-import.contracts"
import { CsvImportSyncService } from "./csv-import-sync.service"
import type { DataSyncContext } from "./data-hub.contracts"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { CSV_COPY } from "./messages/csv-import.messages"

describe("CsvImportSyncService", () => {
    const config: CsvConfig = {
        v: 1,
        source: "sheet",
        entity: "customer",
        idColumn: "id",
        titleColumn: "name",
        dateColumn: null,
        kinds: { id: "text", name: "text", email: "email" },
        columns: ["id", "name", "email"],
        link: "https://docs.google.com/spreadsheets/d/sheet-1",
    }
    const source: Table = {
        headers: ["id", "name", "email"],
        rows: [
            [" customer-1 ", " Alice ", " ALICE@EXAMPLE.COM "],
            ["customer-2", "Bob", "bob@example.com"],
            ["", "Missing id", ""],
        ],
        sheets: [],
        sheet: "",
        delimiter: ",",
    }
    const recordsToWrite = [
        {
            externalId: "customer-1",
            title: "Alice",
            occurredAt: null,
            data: { id: "customer-1", name: "Alice", email: "alice@example.com" },
        },
        {
            externalId: "customer-2",
            title: "Bob",
            occurredAt: null,
            data: { id: "customer-2", name: "Bob", email: "bob@example.com" },
        },
    ]

    const build = async (meta: Readonly<Record<string, string>> = { config: JSON.stringify(config) }) => {
        const records = mock<DataRecordsService>()
        const table = mock<TableClient>()
        const context = mock<DataSyncContext>({
            connection: {
                id: "connection-1",
                workspaceId: "workspace-1",
                provider: "csv_import",
                name: "Customers",
                status: "connected",
                lastError: null,
                meta,
                everyMinutes: 60,
                lastSyncAt: null,
            },
            credential: "{}",
        })
        records.countExisting.mockResolvedValue(1)
        records.count.mockResolvedValue(1234)
        table.readSheetLink.mockResolvedValue(source)
        context.upsert.mockResolvedValue(2)
        const moduleRef = await Test.createTestingModule({
            providers: [
                CsvImportSyncService,
                { provide: DataRecordsService, useValue: records },
                { provide: TABLE, useValue: table },
            ],
        }).compile()
        return { service: moduleRef.get(CsvImportSyncService), records, table, context }
    }

    it("re-reads the saved sheet and upserts its mapped rows with an exact summary", async () => {
        const { service, records, table, context } = await build()

        await expect(service.sync(context)).resolves.toEqual({
            rows: 2,
            note: CSV_COPY.syncNote(1, 1),
            meta: { summary: `${CSV_COPY.entity.customer} \u00b7 1.234 ${CSV_COPY.rowUnit}` },
        })
        expect(service.provider).toBe("csv_import")
        expect(table.readSheetLink).toHaveBeenCalledWith("https://docs.google.com/spreadsheets/d/sheet-1")
        expect(records.countExisting).toHaveBeenCalledWith("connection-1", "customer", ["customer-1", "customer-2"])
        expect(context.upsert).toHaveBeenCalledWith("customer", recordsToWrite)
        expect(records.count).toHaveBeenCalledWith("connection-1")
    })

    it("asks for another upload when the saved configuration is missing", async () => {
        const { service, records, table, context } = await build({})

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, note: CSV_COPY.uploadAgain })
        expect(table.readSheetLink).not.toHaveBeenCalled()
        expect(records.countExisting).not.toHaveBeenCalled()
        expect(context.upsert).not.toHaveBeenCalled()
        expect(records.count).not.toHaveBeenCalled()
    })

    it("asks for another upload when the saved configuration is damaged", async () => {
        const { service, table, context } = await build({ config: "{" })

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, note: CSV_COPY.uploadAgain })
        expect(table.readSheetLink).not.toHaveBeenCalled()
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it.each(["file", "manual", "document"] as const)(
        "asks for another upload when the saved source is %s",
        async (savedSource) => {
            const { service, table, context } = await build({
                config: JSON.stringify({ ...config, source: savedSource }),
            })

            await expect(service.sync(context)).resolves.toEqual({ rows: 0, note: CSV_COPY.uploadAgain })
            expect(table.readSheetLink).not.toHaveBeenCalled()
            expect(context.upsert).not.toHaveBeenCalled()
        },
    )

    it("asks for another upload when the saved sheet has no link", async () => {
        const { service, table, context } = await build({
            config: JSON.stringify({ ...config, link: undefined }),
        })

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, note: CSV_COPY.uploadAgain })
        expect(table.readSheetLink).not.toHaveBeenCalled()
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("refuses a changed sheet and names every missing mapped column", async () => {
        const { service, records, table, context } = await build({
            config: JSON.stringify({ ...config, dateColumn: "joined_at" }),
        })
        table.readSheetLink.mockResolvedValue({ ...source, headers: ["email"] })

        await expect(service.sync(context)).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: CSV_COPY.sheetChanged("id, name, joined_at") },
        })
        expect(records.countExisting).not.toHaveBeenCalled()
        expect(context.upsert).not.toHaveBeenCalled()
        expect(records.count).not.toHaveBeenCalled()
    })

    it("upserts an empty sheet and summarizes the existing total", async () => {
        const { service, records, table, context } = await build()
        table.readSheetLink.mockResolvedValue({ ...source, rows: [] })
        records.countExisting.mockResolvedValue(0)
        records.count.mockResolvedValue(7)
        context.upsert.mockResolvedValue(0)

        await expect(service.sync(context)).resolves.toEqual({
            rows: 0,
            note: CSV_COPY.syncNote(0, 0),
            meta: { summary: `${CSV_COPY.entity.customer} \u00b7 7 ${CSV_COPY.rowUnit}` },
        })
        expect(records.countExisting).toHaveBeenCalledWith("connection-1", "customer", [])
        expect(context.upsert).toHaveBeenCalledWith("customer", [])
        expect(records.count).toHaveBeenCalledWith("connection-1")
    })

    it("propagates a sheet read failure before looking up existing records", async () => {
        const { service, records, table, context } = await build()
        const cause = new Error("sheet unavailable")
        table.readSheetLink.mockRejectedValue(cause)

        await expect(service.sync(context)).rejects.toBe(cause)
        expect(records.countExisting).not.toHaveBeenCalled()
        expect(context.upsert).not.toHaveBeenCalled()
        expect(records.count).not.toHaveBeenCalled()
    })

    it("propagates an existing-record count failure before writing rows", async () => {
        const { service, records, context } = await build()
        const cause = new Error("existing count failed")
        records.countExisting.mockRejectedValue(cause)

        await expect(service.sync(context)).rejects.toBe(cause)
        expect(context.upsert).not.toHaveBeenCalled()
        expect(records.count).not.toHaveBeenCalled()
    })

    it("propagates an upsert failure before counting the saved total", async () => {
        const { service, records, context } = await build()
        const cause = new Error("write failed")
        context.upsert.mockRejectedValue(cause)

        await expect(service.sync(context)).rejects.toBe(cause)
        expect(context.upsert).toHaveBeenCalledWith("customer", recordsToWrite)
        expect(records.count).not.toHaveBeenCalled()
    })

    it("propagates a total-count failure after writing the mapped rows", async () => {
        const { service, records, context } = await build()
        const cause = new Error("total count failed")
        records.count.mockRejectedValue(cause)

        await expect(service.sync(context)).rejects.toBe(cause)
        expect(context.upsert).toHaveBeenCalledWith("customer", recordsToWrite)
        expect(records.count).toHaveBeenCalledWith("connection-1")
    })
})
