import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DataSyncRunsService } from "./data-sync-runs.service"
import type { DataSyncRunRow } from "./persistence/data-sync-runs.rows"
import { FIND_SYNC_RUN } from "./persistence/data-sync-runs.sql"

const ROW: DataSyncRunRow = {
    id: "run-1",
    connection_id: "conn-1",
    trigger: "manual",
    status: "ok",
    rows_upserted: 4,
    error: null,
    started_at: "2026-10-13T03:00:00.000Z",
    finished_at: "2026-10-13T03:05:00.000Z",
}

const build = async (rows: ReadonlyArray<DataSyncRunRow>) => {
    const entityManager = mockEntityManager({ query: [FIND_SYNC_RUN, rows] })
    const moduleRef = await Test.createTestingModule({
        providers: [DataSyncRunsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(DataSyncRunsService)
}

describe("DataSyncRunsService", () => {
    it("answers one run of the workspace", async () => {
        const service = await build([ROW])

        await expect(service.find("ws-1", "run-1")).resolves.toEqual({
            id: "run-1",
            connectionId: "conn-1",
            trigger: "manual",
            state: "ok",
            rows: 4,
            error: null,
            startedAt: "2026-10-13T03:00:00.000Z",
            finishedAt: "2026-10-13T03:05:00.000Z",
        })
    })

    it("answers null when the workspace has no such run", async () => {
        const service = await build([])

        await expect(service.find("ws-1", "missing")).resolves.toBeNull()
    })
})
