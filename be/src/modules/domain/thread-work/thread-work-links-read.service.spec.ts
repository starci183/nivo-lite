import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ThreadWorkEntity } from "./persistence/entities"
import { ThreadWorkLinksReadService } from "./thread-work-links-read.service"

const workOf = entityOf(ThreadWorkEntity, { approvalRequestId: "r-1" })

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ThreadWorkLinksReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(ThreadWorkLinksReadService)
}

describe("ThreadWorkLinksReadService", () => {
    it("names which approval requests an agent's work waits on, nothing for no requests", async () => {
        const em = mockEntityManager({ find: [ThreadWorkEntity, [workOf(), workOf({ approvalRequestId: null })]] })
        const service = await build(em)

        await expect(service.linkedRequestIds("ws-1", [])).resolves.toEqual([])
        await expect(service.linkedRequestIds("ws-1", ["r-1", "r-2"])).resolves.toEqual(["r-1"])
    })

    it("names which threads an agent's work runs in, nothing for no threads", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [{ thread_id: "t-1" }] }])
        const service = await build(em)

        await expect(service.workingThreadIds("ws-1", [])).resolves.toEqual([])
        await expect(service.workingThreadIds("ws-1", ["t-1", "t-2"])).resolves.toEqual(["t-1"])
    })
})
