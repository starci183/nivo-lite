import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { DecisionLogReadService } from "./decision-log-read.service"

const build = async (rows: ReadonlyArray<unknown>) => {
    const em = mockEntityManager()
    const [fake] = queueQueryBuilders(em, [{ getRawMany: rows }])
    const moduleRef = await Test.createTestingModule({
        providers: [DecisionLogReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(DecisionLogReadService), fake }
}

describe("DecisionLogReadService", () => {
    it("reads the newest lines of the workspace without narrowing when no filter is given", async () => {
        const row = { id: "decision-1" }
        const { service, fake } = await build([row])

        await expect(
            service.lines("ws-1", { deciders: null, outcome: null, department: null, limit: 10 }),
        ).resolves.toEqual([row])
        expect(fake?.callsOf("where")).toEqual([["d.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(fake?.callsOf("andWhere")).toEqual([])
        expect(fake?.callsOf("limit")).toEqual([[10]])
    })

    it("narrows by decider, outcome and module", async () => {
        const { service, fake } = await build([])

        await service.lines("ws-1", { deciders: ["staff"], outcome: "rejected", department: "sales", limit: 5 })

        expect(fake?.callsOf("andWhere").map(([sql]) => sql)).toEqual([
            "d.deciderKind IN (:...deciders)",
            "d.outcome = :outcome",
            "d.department = :department",
        ])
    })
})
