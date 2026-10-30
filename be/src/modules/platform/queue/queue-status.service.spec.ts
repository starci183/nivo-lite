import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QueueStatusService } from "./queue-status.service"

const STATEMENT = 'SELECT * FROM "public"."job_status"($1, $2, $3)'

const status = { id: "job-1", state: "queued", attempts: 2 }

const build = async (rows: ReadonlyArray<typeof status>) => {
    const entityManager = mockEntityManager({ query: [STATEMENT, rows] })
    const moduleRef = await Test.createTestingModule({
        providers: [QueueStatusService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(QueueStatusService), entityManager }
}

describe("QueueStatusService", () => {
    it("reads one workspace job by its dedupe key", async () => {
        const { service, entityManager } = await build([status])

        await expect(service.status("ws-1", "mail", "mail:m-1")).resolves.toEqual(status)
        expect(entityManager.query).toHaveBeenCalledWith(STATEMENT, ["ws-1", "mail", "mail:m-1"])
    })

    it("answers null when the workspace has no matching job", async () => {
        const { service } = await build([])

        await expect(service.status("ws-1", "mail", "mail:missing")).resolves.toBeNull()
    })
})
