import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    STEP_FINISHED as FINISHED,
    STEP_STARTED as STARTED,
    stepOf,
    undecidedStepRow,
    unfinishedStepRow,
} from "@tests/fixtures/builders/work-chains-history-read.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { CompletedTask } from "./work-chains-history-read.contracts"
import { WorkChainEntity } from "./persistence/entities"
import { WorkChainsHistoryReadService } from "./work-chains-history-read.service"

const taskOf = (overrides: Partial<CompletedTask> = {}): CompletedTask => ({
    id: "c-1",
    threadId: "t-1",
    actorKind: "agent",
    actorId: "a-1",
    action: "hand_off",
    rule: null,
    decidedBy: "m-1",
    at: FINISHED,
    ...overrides,
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
        const [fake] = queueQueryBuilders(em, [{ getMany: [stepOf(), unfinishedStepRow(), undecidedStepRow()] }])

        await expect((await build(em)).completedTasks("ws-1", 4, 8)).resolves.toEqual([
            taskOf(),
            taskOf({ id: "c-2", at: STARTED }),
        ])
        expect(fake?.callsOf("offset")).toEqual([[4]])
        expect(fake?.callsOf("limit")).toEqual([[8]])
    })
})
