import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import { DataRecordsService } from "@modules/domain/data-records"
import { DataSyncRunsService } from "@modules/domain/data-sync-runs"
import type { DataSyncRun } from "@modules/domain/data-sync-runs"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DataSyncQueue } from "@modules/queues/data-sync"
import { CsvImportSyncService } from "./csv-import-sync.service"
import { DatabaseSyncService } from "./database-sync.service"
import { DATA_PROVIDERS } from "./data-hub.contracts"
import type { DataConnection, DataProvider } from "./data-hub.contracts"
import { DataHubLogEvent } from "./data-hub.log-events"
import { DataHubService } from "./data-hub.service"
import { DataSyncService } from "./data-sync.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { ImapSyncService } from "./imap-sync.service"
import { OpenApiSyncService } from "./openapi-sync.service"
import { TelegramUserSyncService } from "./telegram-user-sync.service"

const actor = { principalId: "u-1", workspaceId: "ws-1" }
const payload = { workspaceId: "ws-1", connectionId: "c-1", runId: "run-1" }
const connectionOf = (provider: DataProvider = "csv_import"): DataConnection => ({
    id: "c-1",
    workspaceId: "ws-1",
    provider,
    name: "Orders",
    status: "connected",
    lastError: null,
    meta: {},
    everyMinutes: 5,
    lastSyncAt: null,
})
const runOf = (id = "run-1", connectionId = "c-1"): DataSyncRun => ({
    id,
    connectionId,
    trigger: "manual",
    state: "running",
    rows: 0,
    error: null,
    startedAt: "2026-10-12T10:00:00.000Z",
    finishedAt: null,
})

const buildKit = async (registerCsv = true) => {
    const entityManager = mockEntityManager()
    const transaction = fakeTransaction(entityManager)
    const clock = new FakeClock("2026-10-12T10:00:00.000Z")
    const catalog = mock<MessageCatalog>()
    const logger = mock<Logger>()
    const queue = mock<DataSyncQueue>()
    const connections = mock<ConnectionsService>()
    const hub = mock<DataHubService>()
    const records = mock<DataRecordsService>()
    const runs = mock<DataSyncRunsService>()
    const csv = mock<CsvImportSyncService>(registerCsv ? { provider: "csv_import" } : {})
    const database = mock<DatabaseSyncService>({ provider: "database" })
    const imap = mock<ImapSyncService>({ provider: "imap" })
    const openapi = mock<OpenApiSyncService>({ provider: "openapi" })
    const telegramUser = mock<TelegramUserSyncService>({ provider: "telegram_user" })
    hub.owner.mockResolvedValue({ role: "owner", displayName: "Owner" })
    hub.own.mockResolvedValue(connectionOf())
    hub.credentialOf.mockResolvedValue("credential")
    runs.open.mockResolvedValue(runOf())
    runs.finish.mockResolvedValue(undefined)
    queue.enqueueSync.mockResolvedValue(undefined)
    connections.markSynced.mockResolvedValue(undefined)
    connections.markSyncFailed.mockResolvedValue(undefined)
    catalog.get.mockReturnValue("Try again")
    const moduleRef = await Test.createTestingModule({
        providers: [
            DataSyncService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: DataSyncQueue, useValue: queue },
            { provide: ConnectionsService, useValue: connections },
            { provide: DataHubService, useValue: hub },
            { provide: DataRecordsService, useValue: records },
            { provide: DataSyncRunsService, useValue: runs },
            { provide: CsvImportSyncService, useValue: csv },
            { provide: DatabaseSyncService, useValue: database },
            { provide: ImapSyncService, useValue: imap },
            { provide: OpenApiSyncService, useValue: openapi },
            { provide: TelegramUserSyncService, useValue: telegramUser },
        ],
    }).compile()
    return {
        service: moduleRef.get(DataSyncService),
        entityManager,
        transaction,
        clock,
        catalog,
        logger,
        queue,
        connections,
        hub,
        records,
        runs,
        csv,
        database,
        imap,
        openapi,
        telegramUser,
    }
}

const build = async () => {
    const { service } = await buildKit()
    return service
}

describe("DataSyncService", () => {
    it("ignores a job payload that is neither a tick nor a sync", async () => {
        const service = await build()

        await expect(service.process({})).resolves.toBeUndefined()
    })

    it("ignores an abandoned job that is not a sync", async () => {
        const service = await build()

        await expect(service.abandonJob({ tick: false })).resolves.toBeUndefined()
    })

    it("authorizes and queues a manual run in the transaction that opens it", async () => {
        const { service, entityManager, transaction, hub, runs, queue } = await buildKit()
        const run = runOf()
        runs.open.mockResolvedValue(run)

        await expect(service.request(actor, "c-1")).resolves.toBe(run)

        const tx = runs.open.mock.calls[0]?.[0]
        expect(tx).toBeDefined()
        expect(tx).not.toBe(entityManager)
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.own).toHaveBeenCalledWith("ws-1", "c-1")
        expect(entityManager.transaction).toHaveBeenCalledTimes(1)
        expect(runs.open).toHaveBeenCalledWith(tx, "ws-1", "c-1", "manual")
        expect(queue.enqueueSync).toHaveBeenCalledWith(payload, tx)
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("refuses a missing opened run and rolls back without queueing", async () => {
        const { service, transaction, runs, queue } = await buildKit()
        runs.open.mockResolvedValue(null)

        await expect(service.request(actor, "c-1")).rejects.toMatchObject({ code: DataHubErrorCode.SyncFailed })

        expect(queue.enqueueSync).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it("rolls back when enqueueing the manual run fails", async () => {
        const { service, transaction, queue } = await buildKit()
        const failure = new TypeError("queue unavailable")
        queue.enqueueSync.mockRejectedValue(failure)

        await expect(service.request(actor, "c-1")).rejects.toBe(failure)

        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it("does not open or queue a run when owner authorization fails", async () => {
        const { service, entityManager, hub, queue } = await buildKit()
        const failure = new DataHubError({ code: DataHubErrorCode.NotFound })
        hub.owner.mockRejectedValue(failure)

        await expect(service.request(actor, "c-1")).rejects.toBe(failure)

        expect(hub.own).not.toHaveBeenCalled()
        expect(entityManager.transaction).not.toHaveBeenCalled()
        expect(queue.enqueueSync).not.toHaveBeenCalled()
    })

    it("authorizes and returns the requested workspace run", async () => {
        const { service, hub, runs } = await buildKit()
        const run = runOf()
        runs.find.mockResolvedValue(run)

        await expect(service.status(actor, "run-1")).resolves.toBe(run)

        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(runs.find).toHaveBeenCalledWith("ws-1", "run-1")
    })
})

describe("DataSyncService", () => {
    it("refuses a missing status run with the not-found code", async () => {
        const { service, runs } = await buildKit()
        runs.find.mockResolvedValue(null)

        await expect(service.status(actor, "absent")).rejects.toMatchObject({ code: DataHubErrorCode.NotFound })

        expect(runs.find).toHaveBeenCalledWith("ws-1", "absent")
    })

    it("claims up to twenty due connections and queues each scheduled run in its own transaction", async () => {
        const { service, entityManager, transaction, connections, runs, queue } = await buildKit()
        connections.claimDueSyncs.mockResolvedValue([
            { id: "c-1", workspaceId: "ws-1" },
            { id: "c-2", workspaceId: "ws-2" },
        ])
        runs.open.mockResolvedValueOnce(runOf()).mockResolvedValueOnce(runOf("run-2", "c-2"))

        await expect(service.queueDue()).resolves.toBe(2)

        const firstTx = runs.open.mock.calls[0]?.[0]
        const secondTx = runs.open.mock.calls[1]?.[0]
        expect(firstTx).toBeDefined()
        expect(secondTx).toBeDefined()
        expect(firstTx).not.toBe(entityManager)
        expect(secondTx).not.toBe(entityManager)
        expect(secondTx).not.toBe(firstTx)
        expect(connections.claimDueSyncs).toHaveBeenCalledWith(DATA_PROVIDERS, 20)
        expect(entityManager.transaction).toHaveBeenCalledTimes(2)
        expect(runs.open).toHaveBeenNthCalledWith(1, firstTx, "ws-1", "c-1", "schedule")
        expect(runs.open).toHaveBeenNthCalledWith(2, secondTx, "ws-2", "c-2", "schedule")
        expect(queue.enqueueSync).toHaveBeenNthCalledWith(1, payload, firstTx)
        expect(queue.enqueueSync).toHaveBeenNthCalledWith(
            2,
            { workspaceId: "ws-2", connectionId: "c-2", runId: "run-2" },
            secondTx,
        )
        expect(transaction.outcomes).toEqual(["commit", "commit"])
    })

    it("answers zero without transactions when no sync is due", async () => {
        const { service, entityManager, connections, queue } = await buildKit()
        connections.claimDueSyncs.mockResolvedValue([])

        await expect(service.queueDue()).resolves.toBe(0)

        expect(entityManager.transaction).not.toHaveBeenCalled()
        expect(queue.enqueueSync).not.toHaveBeenCalled()
    })
})

describe("DataSyncService", () => {
    it("passes the credential, counts written rows and exposes the exact two-minute deadline", async () => {
        const { service, hub, records, csv, clock, connections, runs, logger } = await buildKit()
        const first = [{ externalId: "order-1", data: { paid: true } }]
        const second = [{ externalId: "customer-1", data: { name: "An" } }]
        const meta = { cursor: "next" }
        records.upsert.mockResolvedValueOnce(2).mockResolvedValueOnce(3)
        csv.sync.mockImplementation(async (context) => {
            expect(context.connection).toEqual(connectionOf())
            expect(context.credential).toBe("credential")
            expect(context.isExpired()).toBe(false)
            clock.advance(119_999)
            expect(context.isExpired()).toBe(false)
            clock.advance(1)
            expect(context.isExpired()).toBe(true)
            await expect(context.upsert("order", first)).resolves.toBe(2)
            await expect(context.upsert("customer", second)).resolves.toBe(3)
            return { rows: 9, meta }
        })

        await expect(service.run(payload)).resolves.toBeUndefined()

        expect(hub.own).toHaveBeenCalledWith("ws-1", "c-1")
        expect(hub.credentialOf).toHaveBeenCalledWith("c-1")
        expect(records.upsert).toHaveBeenNthCalledWith(1, "ws-1", "c-1", "order", first)
        expect(records.upsert).toHaveBeenNthCalledWith(2, "ws-1", "c-1", "customer", second)
        expect(connections.markSynced).toHaveBeenCalledWith("c-1", meta)
        expect(runs.finish).toHaveBeenCalledWith("run-1", "ok", 9, null)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it.each(DATA_PROVIDERS)("dispatches %s with an empty missing credential and no result meta", async (provider) => {
        const kit = await buildKit()
        const connector = {
            csv_import: kit.csv,
            database: kit.database,
            imap: kit.imap,
            openapi: kit.openapi,
            telegram_user: kit.telegramUser,
        }[provider]
        kit.hub.own.mockResolvedValue(connectionOf(provider))
        kit.hub.credentialOf.mockResolvedValue(null)
        connector.sync.mockResolvedValue({ rows: 4 })

        await expect(kit.service.run(payload)).resolves.toBeUndefined()

        expect(connector.sync).toHaveBeenCalledTimes(1)
        expect(connector.sync).toHaveBeenCalledWith(
            expect.objectContaining({ connection: connectionOf(provider), credential: "" }),
        )
        expect(kit.connections.markSynced).toHaveBeenCalledWith("c-1", {})
        expect(kit.runs.finish).toHaveBeenCalledWith("run-1", "ok", 4, null)
    })

    it("records a translated domain failure truncated to 500 characters and the rows written before it", async () => {
        const { service, csv, catalog, records, connections, runs, logger } = await buildKit()
        const failure = new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail: "source invalid" } })
        catalog.get.mockReturnValue("r".repeat(501))
        records.upsert.mockResolvedValueOnce(2).mockResolvedValueOnce(3)
        csv.sync.mockImplementation(async (context) => {
            await context.upsert("order", [{ externalId: "a", data: {} }])
            await context.upsert("order", [{ externalId: "b", data: {} }])
            return Promise.reject(failure)
        })

        await expect(service.run(payload)).resolves.toBeUndefined()

        expect(catalog.get).toHaveBeenCalledWith("errors.DATA_HUB_INVALID", { detail: "source invalid" }, "vi")
        expect(logger.error).toHaveBeenCalledWith(DataHubLogEvent.SyncFailed, failure, payload)
        expect(connections.markSyncFailed).toHaveBeenCalledWith("c-1", "r".repeat(500))
        expect(runs.finish).toHaveBeenCalledWith("run-1", "failed", 5, "r".repeat(500))
        expect(connections.markSynced).not.toHaveBeenCalled()
    })
})

describe("DataSyncService", () => {
    it("settles an unexpected failure even when marking the connection failed also rejects", async () => {
        const { service, hub, catalog, connections, runs, logger } = await buildKit()
        const cause = new TypeError("lookup unavailable")
        const failure = new TypeError("mark unavailable")
        hub.own.mockRejectedValue(cause)
        connections.markSyncFailed.mockRejectedValue(failure)

        await expect(service.run(payload)).resolves.toBeUndefined()

        expect(catalog.get).toHaveBeenCalledWith("errors.DATA_HUB_SYNC_FAILED", {}, "vi")
        expect(logger.error).toHaveBeenNthCalledWith(1, DataHubLogEvent.SyncFailed, cause, payload)
        expect(logger.error).toHaveBeenNthCalledWith(2, DataHubLogEvent.SyncCrashed, failure, payload)
        expect(connections.markSyncFailed).toHaveBeenCalledWith("c-1", "Try again")
        expect(runs.finish).toHaveBeenCalledWith("run-1", "failed", 0, "Try again")
    })

    it("records a not-found failure when a connector dependency has no provider registration", async () => {
        const { service, hub, catalog, connections, runs, logger, csv } = await buildKit(false)
        catalog.get.mockReturnValue("No connector")

        await expect(service.run(payload)).resolves.toBeUndefined()

        expect(catalog.get).toHaveBeenCalledWith("errors.DATA_HUB_NOT_FOUND", {}, "vi")
        expect(logger.error).toHaveBeenCalledWith(
            DataHubLogEvent.SyncFailed,
            expect.objectContaining({ code: DataHubErrorCode.NotFound }),
            payload,
        )
        expect(connections.markSyncFailed).toHaveBeenCalledWith("c-1", "No connector")
        expect(runs.finish).toHaveBeenCalledWith("run-1", "failed", 0, "No connector")
        expect(hub.credentialOf).not.toHaveBeenCalled()
        expect(csv.sync).not.toHaveBeenCalled()
    })

    it("processes a tick by claiming and queueing due connections", async () => {
        const { service, connections, queue } = await buildKit()
        connections.claimDueSyncs.mockResolvedValue([{ id: "c-1", workspaceId: "ws-1" }])

        await expect(service.process({ tick: true })).resolves.toBeUndefined()

        expect(connections.claimDueSyncs).toHaveBeenCalledWith(DATA_PROVIDERS, 20)
        expect(queue.enqueueSync).toHaveBeenCalledWith(payload, expect.anything())
    })

    it("processes a sync payload through its connector", async () => {
        const { service, csv, runs } = await buildKit()
        csv.sync.mockResolvedValue({ rows: 6 })

        await expect(service.process(payload)).resolves.toBeUndefined()

        expect(csv.sync).toHaveBeenCalledTimes(1)
        expect(runs.finish).toHaveBeenCalledWith("run-1", "ok", 6, null)
    })

    it("settles an exhausted sync job with the general Vietnamese failure", async () => {
        const { service, catalog, runs, hub } = await buildKit()

        await expect(service.abandonJob(payload)).resolves.toBeUndefined()

        expect(catalog.get).toHaveBeenCalledWith("errors.DATA_HUB_SYNC_FAILED", {}, "vi")
        expect(runs.finish).toHaveBeenCalledWith("run-1", "failed", 0, "Try again")
        expect(hub.own).not.toHaveBeenCalled()
    })
})
