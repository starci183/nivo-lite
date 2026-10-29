import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { MoreThanOrEqual } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { DecisionsFiguresService } from "./decisions-figures.service"
import { DecisionEntity } from "./persistence/entities"

const decisionOf = entityOf(DecisionEntity, {
    id: "d1",
    workspaceId: "ws-1",
    workItemId: "w1",
    leadId: "l1",
    department: "sales",
    action: "reply",
    decidedBy: "Lan",
    deciderKind: "owner",
    outcome: "approved",
    reason: null,
    note: "ok",
    createdAt: new Date("2026-10-12T03:00:00.000Z"),
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [DecisionsFiguresService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(DecisionsFiguresService)
}

describe("DecisionsFiguresService", () => {
    it("lists the decisions taken from an instant on", async () => {
        const em = mockEntityManager({ find: [DecisionEntity, [decisionOf()]] })
        const from = new Date("2026-10-05T00:00:00.000Z")

        await expect((await build(em)).since("ws-1", from)).resolves.toEqual([
            {
                workItemId: "w1",
                leadId: "l1",
                deciderKind: "owner",
                outcome: "approved",
                createdAt: new Date("2026-10-12T03:00:00.000Z"),
            },
        ])
        expect(em.find).toHaveBeenCalledWith(DecisionEntity, {
            select: { workItemId: true, leadId: true, deciderKind: true, outcome: true, createdAt: true },
            where: { workspaceId: "ws-1", createdAt: MoreThanOrEqual(from) },
        })
    })

    it("lists the newest decisions, newest first, bounded", async () => {
        const em = mockEntityManager({ find: [DecisionEntity, [decisionOf()]] })

        await expect((await build(em)).recent("ws-1", 40)).resolves.toEqual([
            {
                id: "d1",
                workItemId: "w1",
                leadId: "l1",
                department: "sales",
                action: "reply",
                decidedBy: "Lan",
                deciderKind: "owner",
                outcome: "approved",
                reason: null,
                note: "ok",
                createdAt: new Date("2026-10-12T03:00:00.000Z"),
            },
        ])
        expect(em.find).toHaveBeenCalledWith(
            DecisionEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1" }, order: { createdAt: "DESC" }, take: 40 }),
        )
    })
})
