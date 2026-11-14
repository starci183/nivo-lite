import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import type { DataEntity, DataRecordInput } from "@modules/domain/data-records"
import { DataSourcesErrorCode } from "@modules/integrations/data-sources"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { DataConnectorRegistryService } from "./data-connector-registry.service"
import type { DataConnection, DataSyncContext, DataSyncResult } from "./data-hub.contracts"
import {
    DATABASE_CASE,
    DATABASE_SANDBOX_CASES,
    DATABASE_SANDBOX_CATALOGUE,
    DATABASE_SANDBOX_TABLES,
    databasePullOf,
} from "./database-sandbox.catalogue"
import { DatabaseSandboxSyncService } from "./database-sandbox-sync.service"
import { DataHubErrorCode } from "./errors/data-hub.error"

const ACCOUNT = sandboxAccount({ id: "db-sbx", workspaceId: "ws-1", provider: "database" })
const CONNECTION: DataConnection = {
    id: "db-sbx",
    workspaceId: "ws-1",
    provider: "database",
    name: "Sandbox database",
    status: "connected",
    lastError: null,
    meta: {},
    everyMinutes: 15,
    lastSyncAt: null,
    sandbox: true,
}

/** One account's pulls: the keep path is a hub double, and the result's cursors are merged into the connection's meta as `markSynced` does. */
const setup = () => {
    const { sandbox, store } = sandboxServiceOf(ACCOUNT)
    const kept: Array<{ readonly entity: DataEntity; readonly rows: ReadonlyArray<DataRecordInput> }> = []
    let connection = CONNECTION
    const service = new DatabaseSandboxSyncService(sandbox)
    const contextOf = (current: DataConnection): DataSyncContext => ({
        connection: current,
        credential: "",
        isExpired: () => false,
        upsert: (entity, rows) => {
            kept.push({ entity, rows })
            return Promise.resolve(rows.length)
        },
    })
    const pull = async (): Promise<DataSyncResult> => {
        const result = await service.sync(contextOf(connection))
        connection = { ...connection, meta: { ...connection.meta, ...result.meta } }
        return result
    }
    const keptOf = (entity: DataEntity): ReadonlyArray<string> => kept.filter((one) => one.entity === entity).flatMap((one) => one.rows.map((row) => `${row.externalId}:${String(row.data.status ?? "")}`))
    return { sandbox, store, service, pull, kept, keptOf, contextOf }
}

describe("DatabaseSandboxSyncService", () => {
    it("DATABASE-1 is the default: the first pull brings 3 customers, 3 orders and 3 products into their hub entities and moves each table's cursor", async () => {
        const { pull, keptOf } = setup()

        await expect(pull()).resolves.toEqual({
            rows: 9,
            meta: {
                "cursor:public.customers": "2026-11-01T08:10:00.000Z",
                "cursor:public.orders": "2026-11-01T10:00:00.000Z",
                "cursor:public.products": "2026-11-01T07:10:00.000Z",
            },
        })

        expect(keptOf("customer")).toEqual(["1:", "2:", "3:"])
        expect(keptOf("order")).toEqual(["1001:paid", "1002:new", "1003:new"])
        expect(keptOf("product")).toEqual(["SKU-1:", "SKU-2:", "SKU-3:"])
    })

    it("a row has the live shape: external id, title, the source's change as the moment, the columns plus updated_at", async () => {
        const { pull, kept } = setup()

        await pull()

        const orders = kept.find((one) => one.entity === "order")?.rows[0]
        expect(orders).toEqual({
            externalId: "1001",
            title: "DH1001",
            occurredAt: new Date("2026-11-01T09:00:00.000Z"),
            data: { id: 1001, order_no: "DH1001", customer_id: 1, status: "paid", total: 350_000, updated_at: "2026-11-01T09:00:00.000Z" },
        })
    })

    it("a second pull brings nothing new (the cursors hold), with no meta", async () => {
        const { pull, kept } = setup()

        await pull()
        await expect(pull()).resolves.toEqual({ rows: 0 })

        expect(kept.flatMap((one) => one.rows)).toHaveLength(9)
    })

    it("DATABASE-2: after a first read, only the two new orders come, and the orders cursor moves", async () => {
        const { sandbox, pull, keptOf } = setup()
        await pull()
        await sandbox.setNextCase(ACCOUNT, "pull", DATABASE_CASE.newOrders)

        await expect(pull()).resolves.toEqual({ rows: 2, meta: { "cursor:public.orders": "2026-11-08T09:30:00.000Z" } })

        expect(keptOf("order").slice(3)).toEqual(["1004:new", "1005:new"])
    })

    it("DATABASE-2 as a first read brings everything up to the new orders: 3 + 5 + 3 rows", async () => {
        const { sandbox, pull } = setup()
        await sandbox.setNextCase(ACCOUNT, "pull", DATABASE_CASE.newOrders)

        await expect(pull()).resolves.toMatchObject({ rows: 11 })
    })

    it("DATABASE-3: the order marked paid comes again as the SAME row with the new status, and nothing else comes", async () => {
        const { sandbox, pull, keptOf } = setup()
        await pull()
        await sandbox.setNextCase(ACCOUNT, "pull", DATABASE_CASE.changedRow)

        await expect(pull()).resolves.toEqual({
            rows: 3,
            meta: { "cursor:public.orders": "2026-11-12T11:00:00.000Z" },
        })

        // The two new orders of the earlier moment were never read in this account: they come with the change (the cursor is the first read's).
        expect(keptOf("order").slice(3).toSorted()).toEqual(["1002:paid", "1004:new", "1005:new"])
    })

    it("DATABASE-4: the orders table is refused, customers and products are brought and the note names the table; no orders cursor", async () => {
        const { sandbox, pull, keptOf } = setup()
        await sandbox.setNextCase(ACCOUNT, "pull", DATABASE_CASE.oneTableFails)

        const result = await pull()

        expect(result.rows).toBe(6)
        expect(result.note).toBe("public.orders: permission denied for table orders")
        expect(result.meta).toEqual({ "cursor:public.customers": "2026-11-01T08:10:00.000Z", "cursor:public.products": "2026-11-01T07:10:00.000Z" })
        expect(keptOf("order")).toEqual([])
    })

    it("DATABASE-5: every table refused fails the run as the live pull does (the plain refusal naming the first table), nothing kept", async () => {
        const { sandbox, service, contextOf, kept } = setup()
        await sandbox.setNextCase(ACCOUNT, "pull", DATABASE_CASE.everyTableFails)

        const failure = await service.sync(contextOf(CONNECTION)).then(() => null, (cause: unknown) => cause)

        expect(failure).toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: "public.customers: permission denied for table customers" } })
        expect(kept).toEqual([])
        expect((await sandbox.calls(ACCOUNT, "pull"))[0]?.result).toMatchObject({ outcome: "threw", error: DataHubErrorCode.Invalid })
    })

    it.each([
        [DATABASE_CASE.loginRefused, DataSourcesErrorCode.Rejected, "password authentication failed for user"],
        [DATABASE_CASE.unreachable, DataSourcesErrorCode.Unavailable, "connection timed out"],
    ])("%s throws the data-sources error the live reader throws (%s) before any table is read", async (caseId, code, detail) => {
        const { sandbox, service, contextOf, kept } = setup()
        await sandbox.setNextCase(ACCOUNT, "pull", caseId)

        const failure = await service.sync(contextOf(CONNECTION)).then(() => null, (cause: unknown) => cause)

        expect(failure).toMatchObject({ code, params: { detail } })
        expect(kept).toEqual([])
    })

    it("stops early when the run's time budget is spent, keeping what was read", async () => {
        const { service, contextOf, kept } = setup()
        let reads = 0
        const context = { ...contextOf(CONNECTION), isExpired: () => (reads += 1) > 1 }

        const result = await service.sync(context)

        expect(result.rows).toBe(3)
        expect(kept).toHaveLength(1)
    })

    it("logs exactly one call per pull, also the one that brought nothing, keyed by nothing", async () => {
        const { sandbox, pull } = setup()

        await pull()
        await pull()

        const calls = await sandbox.calls(ACCOUNT, "pull")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ result: { outcome: "answered", value: { rows: 9 } } })
    })

    it("is deterministic: a fresh account brings the same rows", async () => {
        const first = setup()
        const second = setup()

        await first.pull()
        await second.pull()

        expect(second.kept).toEqual(first.kept)
    })

    it("refuses a live account and a switched-off sandbox, before anything is kept", async () => {
        const { service, contextOf, kept } = setup()
        const off = new DatabaseSandboxSyncService(sandboxServiceOff(ACCOUNT).sandbox)
        const live: DataConnection = { ...CONNECTION }
        delete (live as { sandbox?: true }).sandbox

        await expect(service.sync(contextOf(live))).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(off.sync(contextOf(CONNECTION))).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
        expect(kept).toEqual([])
    })

    it("is the twin the registry answers for a sandbox database, and the live connector for a live one", () => {
        const { service } = setup()
        const live = { provider: "database" as const, sync: jest.fn() }
        const registry = new DataConnectorRegistryService()
        registry.register({ live, sandbox: service })

        expect(registry.portFor({ provider: "database", sandbox: true })).toBe(service)
        expect(registry.portFor({ provider: "database", sandbox: false })).toBe(live)
    })

    it("has unique DATABASE-<n> ids 1..7, exactly one default case, all for the pull operation", () => {
        expect(DATABASE_SANDBOX_CASES.map((one) => one.id)).toEqual(Array.from({ length: 7 }, (_, index) => `DATABASE-${String(index + 1)}`))
        expect(DATABASE_SANDBOX_CASES.filter((one) => one.default === true).map((one) => one.id)).toEqual(["DATABASE-1"])
        expect(DATABASE_SANDBOX_CASES.every((one) => one.operation === "pull" && one.inbound === undefined && one.label.length > 0)).toBe(true)
        expect(DATABASE_SANDBOX_CATALOGUE.provider).toBe("database")
        expect(Object.values(DATABASE_CASE)).toEqual(DATABASE_SANDBOX_CASES.map((one) => one.id))
    })

    it("has a history whose versions are in time order, each moment reading the latest version", () => {
        const orders = DATABASE_SANDBOX_TABLES.find((table) => table.table === "orders")
        assert(orders !== undefined)
        expect(databasePullOf(orders, 1, null).rows.map((row) => row.data.status)).toEqual(["paid", "new", "new"])
        expect(databasePullOf(orders, 3, null).rows.map((row) => `${row.externalId}:${String(row.data.status)}`)).toContain("1002:paid")
        for (const table of DATABASE_SANDBOX_TABLES) {
            for (const row of table.rows) {
                const stamps = row.versions.map((version) => version.updatedAt)
                expect(stamps).toEqual(stamps.toSorted())
            }
        }
    })

    it("has zero network: the sandbox frame only, no database client, no credential, no clock, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        const catalogue = readFileSync(__filename.replace("-sync.service.spec.ts", ".catalogue.ts"), "utf8")

        expect(DatabaseSandboxSyncService.length).toBe(1)
        for (const text of [source, catalogue]) {
            expect(text).not.toContain("@modules/integrations")
            expect(text).not.toContain("http")
            expect(text).not.toContain("parseTarget")
            expect(text).not.toContain("Date.now")
            expect(text).not.toContain("credentialOf")
        }
    })
})
