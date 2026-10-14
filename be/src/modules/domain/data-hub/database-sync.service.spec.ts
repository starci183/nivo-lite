import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { DatabaseClient, DatabaseReader, DatabaseTarget } from "@modules/integrations/data-sources"
import { DATABASE, DataSourcesError, DataSourcesErrorCode } from "@modules/integrations/data-sources"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { TableMapping } from "./database-config.contracts"
import { DatabaseSyncService } from "./database-sync.service"
import type { DataSyncContext } from "./data-hub.contracts"
import { DataHubErrorCode } from "./errors/data-hub.error"

describe("DatabaseSyncService", () => {
    const target: DatabaseTarget = {
        engine: "postgres",
        host: "database.example.com",
        port: 5432,
        database: "sales",
        user: "reader",
        password: "password",
        ssl: true,
    }
    const customers: TableMapping = {
        schema: "public",
        table: "customers",
        entity: "customer",
        idColumn: "id",
        titleColumn: "name",
        updatedColumn: "updated_at",
        columns: ["id", "name"],
    }
    const orders: TableMapping = { ...customers, table: "orders", entity: "order" }
    const row = {
        externalId: "customer-1",
        title: "Alice",
        occurredAt: null,
        data: { id: "customer-1", name: "Alice" },
    }

    const build = async (tables: ReadonlyArray<TableMapping> = [customers]) => {
        const database = mock<DatabaseClient>()
        const reader = mock<DatabaseReader>()
        const catalog = mock<MessageCatalog>()
        const context = mock<DataSyncContext>({
            connection: {
                id: "connection-1",
                workspaceId: "workspace-1",
                provider: "database",
                name: "Sales",
                status: "connected",
                lastError: null,
                meta: { config: JSON.stringify({ tables }), "cursor:public.customers": "2026-10-12T10:00:00.000Z" },
                everyMinutes: 60,
                lastSyncAt: null,
            },
            credential: JSON.stringify(target),
        })
        database.read.mockImplementation((_target, run) => run(reader))
        context.isExpired.mockReturnValue(false)
        context.upsert.mockResolvedValue(1)
        reader.readTable.mockResolvedValue({ records: [row], cursor: "2026-10-13T10:00:00.000Z" })
        const moduleRef = await Test.createTestingModule({
            providers: [
                DatabaseSyncService,
                { provide: DATABASE, useValue: database },
                { provide: MESSAGE_CATALOG, useValue: catalog },
            ],
        }).compile()
        return { service: moduleRef.get(DatabaseSyncService), database, reader, catalog, context }
    }

    it("reads the mapped table with its saved cursor and returns the written rows and next cursor", async () => {
        const { service, database, reader, context } = await build()

        await expect(service.sync(context)).resolves.toEqual({
            rows: 1,
            meta: { "cursor:public.customers": "2026-10-13T10:00:00.000Z" },
        })
        expect(service.provider).toBe("database")
        expect(database.read.mock.calls[0]?.[0]).toEqual(target)
        expect(reader.readTable).toHaveBeenCalledWith(customers, {
            limit: 5000,
            cursor: "2026-10-12T10:00:00.000Z",
        })
        expect(context.upsert).toHaveBeenCalledWith("customer", [row])
    })

    it("omits cursor metadata when the reader has no new cursor", async () => {
        const { service, reader, context } = await build()
        reader.readTable.mockResolvedValue({ records: [], cursor: null })
        context.upsert.mockResolvedValue(0)

        await expect(service.sync(context)).resolves.toEqual({ rows: 0 })
        expect(context.upsert).toHaveBeenCalledWith("customer", [])
    })

    it("continues after a domain failure and reports it next to the successful table", async () => {
        const { service, reader, catalog, context } = await build([customers, orders])
        const cause = new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail: "access denied" } })
        reader.readTable.mockRejectedValueOnce(cause)
        catalog.get.mockReturnValue("Access denied")

        await expect(service.sync(context)).resolves.toEqual({
            rows: 1,
            note: "public.customers: Access denied",
            meta: { "cursor:public.orders": "2026-10-13T10:00:00.000Z" },
        })
        expect(catalog.get).toHaveBeenCalledWith("errors.DATA_SOURCES_REJECTED", { detail: "access denied" }, "vi")
        expect(reader.readTable).toHaveBeenNthCalledWith(2, orders, { limit: 5000, cursor: undefined })
        expect(context.upsert).toHaveBeenCalledWith("order", [row])
    })

    it("rejects with the first localized failure when no table succeeds", async () => {
        const { service, reader, catalog, context } = await build([customers, orders])
        reader.readTable.mockRejectedValue(new DataSourcesError({ code: DataSourcesErrorCode.Unavailable }))
        catalog.get.mockReturnValue("Server unavailable")

        await expect(service.sync(context)).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: "public.customers: Server unavailable" },
        })
        expect(reader.readTable).toHaveBeenCalledTimes(2)
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("stops reading when the sync budget expires", async () => {
        const { service, reader, context } = await build([customers, orders])
        context.isExpired.mockReturnValueOnce(false).mockReturnValue(true)

        await expect(service.sync(context)).resolves.toEqual({
            rows: 1,
            meta: { "cursor:public.customers": "2026-10-13T10:00:00.000Z" },
        })
        expect(reader.readTable).toHaveBeenCalledTimes(1)
    })

    it("returns no rows when the budget has already expired", async () => {
        const { service, reader, context } = await build()
        context.isExpired.mockReturnValue(true)

        await expect(service.sync(context)).resolves.toEqual({ rows: 0 })
        expect(reader.readTable).not.toHaveBeenCalled()
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("propagates an unexpected reader failure without attempting the next table", async () => {
        const { service, reader, catalog, context } = await build([customers, orders])
        const cause = new Error("unexpected driver failure")
        reader.readTable.mockRejectedValueOnce(cause)

        await expect(service.sync(context)).rejects.toBe(cause)
        expect(reader.readTable).toHaveBeenCalledTimes(1)
        expect(catalog.get).not.toHaveBeenCalled()
    })

    it("propagates an unexpected persistence failure", async () => {
        const { service, context } = await build()
        const cause = new Error("write failed")
        context.upsert.mockRejectedValue(cause)

        await expect(service.sync(context)).rejects.toBe(cause)
    })
})
