import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DataSyncRunsService } from "./data-sync-runs.service"
import type { DataSyncRunRow } from "./persistence/data-sync-runs.rows"
import { FIND_SYNC_RUN, FINISH_SYNC_RUN, INSERT_SYNC_RUN } from "./persistence/data-sync-runs.sql"

const rowOf = builder<DataSyncRunRow>({
    id: "run-1",
    connection_id: "conn-1",
    trigger: "manual",
    status: "running",
    rows_upserted: 0,
    error: null,
    started_at: "2026-10-13T03:00:00.000Z",
    finished_at: null,
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
        const tx = mockEntityManager({ query: [INSERT_SYNC_RUN, [rowOf({ trigger: "schedule" })]] })
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
        expect(tx.query.mock.calls).toEqual([[INSERT_SYNC_RUN, ["ws-1", "conn-1", "schedule"]]])
        expect(own.query).not.toHaveBeenCalled()
    })

    it("answers null when the insert returns no row", async () => {
        const tx = mockEntityManager({ query: [INSERT_SYNC_RUN, []] })
        const runs = await build(mockEntityManager())

        await expect(runs.open(tx, "ws-1", "conn-1", "push")).resolves.toBeNull()
    })
})

describe("DataSyncRunsService / finish", () => {
    it("settles the run with its state, rows and failure", async () => {
        const em = mockEntityManager({ query: [FINISH_SYNC_RUN, []] })
        const runs = await build(em)

        await expect(runs.finish("run-1", "failed", 12, "Sheet not shared")).resolves.toBeUndefined()

        expect(em.query.mock.calls).toEqual([[FINISH_SYNC_RUN, ["run-1", "failed", 12, "Sheet not shared"]]])
    })
})

describe("DataSyncRunsService / find", () => {
    it("answers a settled run of the workspace", async () => {
        const em = mockEntityManager({
            query: [
                FIND_SYNC_RUN,
                [
                    rowOf({
                        status: "ok",
                        rows_upserted: 40,
                        finished_at: "2026-10-13T03:01:00.000Z",
                        trigger: "upload",
                    }),
                ],
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
        expect(em.query).toHaveBeenCalledWith(FIND_SYNC_RUN, ["ws-1", "run-1"])
    })

    it("reads an unknown trigger as manual and an unknown status as running", async () => {
        const em = mockEntityManager({ query: [FIND_SYNC_RUN, [rowOf({ trigger: "legacy", status: "queued" })]] })
        const runs = await build(em)

        await expect(runs.find("ws-1", "run-1")).resolves.toMatchObject({ trigger: "manual", state: "running" })
    })

    it("answers null for a run the workspace does not have", async () => {
        const em = mockEntityManager({ query: [FIND_SYNC_RUN, []] })
        const runs = await build(em)

        await expect(runs.find("ws-1", "run-9")).resolves.toBeNull()
    })
})
