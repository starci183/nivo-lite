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
    it("reads recorded member ids for the newest decision of the bounded item batch, never its display labels", async () => {
        const { service, fake } = await build([
            { workItemId: "item-1", memberId: "member-1" },
            { workItemId: "legacy", memberId: null },
        ])
        await expect(service.decidersOf(["item-1", "legacy"])).resolves.toEqual(
            new Map([
                ["item-1", "member-1"],
                ["legacy", null],
            ]),
        )
        expect(fake?.callsOf("where")).toEqual([["d.workItemId IN (:...itemIds)", { itemIds: ["item-1", "legacy"] }]])
        expect(fake?.callsOf("distinctOn")).toEqual([[["d.workItemId"]]])
        expect(fake?.callsOf("limit")).toEqual([[2]])
    })

    it("reads no decision actors for an empty batch", async () => {
        const { service, fake } = await build([])
        await expect(service.decidersOf([])).resolves.toEqual(new Map())
        expect(fake?.callsOf("where")).toEqual([])
    })

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
