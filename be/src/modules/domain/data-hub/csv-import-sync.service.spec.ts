import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DataRecordsService } from "@modules/domain/data-records"
import type { Table, TableClient } from "@modules/integrations/data-sources"
import { TABLE } from "@modules/integrations/data-sources"
import { CsvImportSyncService } from "./csv-import-sync.service"
import type { DataConnection, DataSyncContext } from "./data-hub.contracts"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { CSV_COPY } from "./messages/csv-import.messages"

const connection = (meta: DataConnection["meta"]): DataConnection => ({
    id: "connection-1",
    workspaceId: "ws-1",
    provider: "csv_import",
    name: "Customers",
    status: "connected",
    lastError: null,
    meta,
    everyMinutes: 60,
    lastSyncAt: null,
})

const sheet: Table = {
    headers: ["id", "name"],
    rows: [
        ["KH1", "Lan"],
        ["KH2", "Minh"],
    ],
    sheets: ["Customers"],
    sheet: "Customers",
    delimiter: ",",
}

const saved = {
    v: 1,
    source: "sheet",
    entity: "customer",
    idColumn: "id",
    titleColumn: "name",
    dateColumn: null,
    kinds: { id: "text", name: "text" },
    columns: ["id", "name"],
    link: "https://docs.google.com/spreadsheets/d/sheet-1",
}

describe("CsvImportSyncService", () => {
    const build = async () => {
        const records = mock<DataRecordsService>()
        const table = mock<TableClient>()
        records.countExisting.mockResolvedValue(1)
        records.count.mockResolvedValue(4)
        table.readSheetLink.mockResolvedValue(sheet)
        const moduleRef = await Test.createTestingModule({
            providers: [
                CsvImportSyncService,
                { provide: DataRecordsService, useValue: records },
                { provide: TABLE, useValue: table },
            ],
        }).compile()
        return { sync: moduleRef.get(CsvImportSyncService), records, table }
    }

    it("serves the csv import provider", async () => {
        const { sync } = await build()
        expect(sync.provider).toBe("csv_import")
    })

    it("re-reads the saved sheet, upserts the rows and reports how many were new", async () => {
        const { sync, records, table } = await build()
        const upsert = jest.fn().mockResolvedValue(2)
        const context: DataSyncContext = {
            connection: connection({ config: JSON.stringify(saved) }),
            credential: "{}",
            upsert,
            isExpired: () => false,
        }

        await expect(sync.sync(context)).resolves.toEqual({
            rows: 2,
            note: CSV_COPY.syncNote(1, 1),
            meta: { summary: `${CSV_COPY.entity.customer} · 4 ${CSV_COPY.rowUnit}` },
        })
        expect(table.readSheetLink).toHaveBeenCalledWith(saved.link)
        expect(records.countExisting).toHaveBeenCalledWith("connection-1", "customer", ["KH1", "KH2"])
        expect(upsert).toHaveBeenCalledWith("customer", [
            { externalId: "KH1", title: "Lan", occurredAt: null, data: { id: "KH1", name: "Lan" } },
            { externalId: "KH2", title: "Minh", occurredAt: null, data: { id: "KH2", name: "Minh" } },
        ])
        expect(records.count).toHaveBeenCalledWith("connection-1")
    })

    it.each([
        ["a missing config", {}],
        ["a damaged config", { config: "{" }],
        ["a file import", { config: JSON.stringify({ ...saved, source: "file" }) }],
        ["a sheet with no link", { config: JSON.stringify({ ...saved, link: undefined }) }],
    ])("asks for a new upload when the connection is %s", async (_label, meta) => {
        const { sync, table } = await build()
        const context: DataSyncContext = {
            connection: connection(meta),
            credential: "{}",
            upsert: jest.fn(),
            isExpired: () => false,
        }
        await expect(sync.sync(context)).resolves.toEqual({ rows: 0, note: CSV_COPY.uploadAgain })
        expect(table.readSheetLink).not.toHaveBeenCalled()
    })

    it("refuses a sheet that lost a mapped column", async () => {
        const { sync, table } = await build()
        table.readSheetLink.mockResolvedValue({ ...sheet, headers: ["name"], rows: [["Lan"]] })
        const context: DataSyncContext = {
            connection: connection({ config: JSON.stringify(saved) }),
            credential: "{}",
            upsert: jest.fn(),
            isExpired: () => false,
        }
        await expect(sync.sync(context)).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: CSV_COPY.sheetChanged("id") },
        })
    })
})
