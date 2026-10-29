import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityRowBuilder, namedCalls } from "@tests/fixtures/builders/entity-row.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { DataSyncRunsService } from "./data-sync-runs.service"
import { DataSyncRunEntity } from "./persistence/entities"

const rowOf = entityRowBuilder<DataSyncRunEntity>({
    id: "run-1",
    workspaceId: "ws-1",
    connectionId: "conn-1",
    trigger: "manual",
    status: "running",
    rowsUpserted: 0,
    error: null,
    startedAt: new Date("2026-10-13T03:00:00.000Z"),
    finishedAt: null,
})

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [DataSyncRunsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(DataSyncRunsService)
}

describe("DataSyncRunsService / open", () => {
    it("opens a running run in the caller's transaction and answers it", async () => {
        const own = mockEntityManager()
        const tx = mockEntityManager()
        const [insert] = queueQueryBuilders(tx, [{ execute: { raw: [rowOf({ trigger: "schedule" })] } }])
        const runs = await build(own)

        await expect(runs.open(tx, "ws-1", "conn-1", "schedule")).resolves.toEqual({
            id: "run-1",
            connectionId: "conn-1",
            trigger: "schedule",
            state: "running",
            rows: 0,
            error: null,
            startedAt: "2026-10-13T03:00:00.000Z",
            finishedAt: null,
        })
        expect(insert?.callsOf("insert")).toEqual([[]])
        expect(insert?.callsOf("values")).toEqual([
            [{ workspaceId: "ws-1", connectionId: "conn-1", trigger: "schedule" }],
        ])
        expect(own.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("answers null when the insert returns no row", async () => {
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ execute: { raw: [] } }])
        const runs = await build(mockEntityManager())

        await expect(runs.open(tx, "ws-1", "conn-1", "manual")).resolves.toBeNull()
    })
})

describe("DataSyncRunsService / finish", () => {
    it("settles the run with its state, rows and failure", async () => {
        const em = mockEntityManager({ update: [DataSyncRunEntity, { affected: 1 }] })
        const runs = await build(em)

        await expect(runs.finish("run-1", "failed", 12, "Sheet not shared")).resolves.toBeUndefined()

        expect(namedCalls(em.update.mock.calls, 2)).toEqual([
            [
                "DataSyncRunEntity",
                { id: "run-1", status: "running" },
                { status: "failed", rowsUpserted: 12, error: "Sheet not shared", finishedAt: "function" },
            ],
        ])
    })
})

describe("DataSyncRunsService / find", () => {
    it("answers a settled run of the workspace", async () => {
        const em = mockEntityManager({
            findOne: [
                DataSyncRunEntity,
                rowOf({
                    status: "ok",
                    rowsUpserted: 40,
                    finishedAt: new Date("2026-10-13T03:01:00.000Z"),
                    trigger: "upload",
                }),
            ],
        })
        const runs = await build(em)

        await expect(runs.find("ws-1", "run-1")).resolves.toEqual({
            id: "run-1",
            connectionId: "conn-1",
            trigger: "upload",
            state: "ok",
            rows: 40,
            error: null,
            startedAt: "2026-10-13T03:00:00.000Z",
            finishedAt: "2026-10-13T03:01:00.000Z",
        })
        expect(em.findOne).toHaveBeenCalledWith(DataSyncRunEntity, { where: { workspaceId: "ws-1", id: "run-1" } })
    })

    it("reads an unknown trigger as manual and an unknown status as running", async () => {
        const em = mockEntityManager({
            findOne: [DataSyncRunEntity, Object.assign(rowOf(), { trigger: "legacy", status: "queued" })],
        })
        const runs = await build(em)

        await expect(runs.find("ws-1", "run-1")).resolves.toMatchObject({ trigger: "manual", state: "running" })
    })

    it("answers null for a run the workspace does not have", async () => {
        const em = mockEntityManager({ findOne: [DataSyncRunEntity, null] })
        const runs = await build(em)

        await expect(runs.find("ws-1", "run-9")).resolves.toBeNull()
    })
})
