import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { WorkChainEntity } from "./persistence/entities"
import { WorkChainsHistoryReadService } from "./work-chains-history-read.service"

const STARTED = new Date("2026-10-11T03:00:00.000Z")
const FINISHED = new Date("2026-10-12T03:00:00.000Z")
const stepOf = entityOf(WorkChainEntity, {
    id: "c-1",
    threadId: "t-1",
    actorKind: "agent",
    actorId: "a-1",
    action: "hand_off",
    rule: null,
    decidedBy: "m-1",
    startedAt: STARTED,
    finishedAt: FINISHED,
})

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkChainsHistoryReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(WorkChainsHistoryReadService)
}

describe("WorkChainsHistoryReadService", () => {
    it("names the thread of each step, nothing for no steps", async () => {
        const em = mockEntityManager({ find: [WorkChainEntity, [stepOf()]] })
        const service = await build(em)

        await expect(service.threadsOfSteps("ws-1", [])).resolves.toEqual([])
        await expect(service.threadsOfSteps("ws-1", ["c-1"])).resolves.toEqual([{ id: "c-1", threadId: "t-1" }])
        expect(em.find).toHaveBeenCalledTimes(1)
    })

    it("lists the completed tasks newest first, counting an unfinished step at its start", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [
            { getMany: [stepOf(), stepOf({ id: "c-2", finishedAt: null }), stepOf({ id: "c-3", decidedBy: null })] },
        ])

        await expect((await build(em)).completedTasks("ws-1", 4, 8)).resolves.toEqual([
            {
                id: "c-1",
                threadId: "t-1",
                actorKind: "agent",
                actorId: "a-1",
                action: "hand_off",
                rule: null,
                decidedBy: "m-1",
                at: FINISHED,
            },
            {
                id: "c-2",
                threadId: "t-1",
                actorKind: "agent",
                actorId: "a-1",
                action: "hand_off",
                rule: null,
                decidedBy: "m-1",
                at: STARTED,
            },
        ])
        expect(fake?.callsOf("offset")).toEqual([[4]])
        expect(fake?.callsOf("limit")).toEqual([[8]])
    })
})
