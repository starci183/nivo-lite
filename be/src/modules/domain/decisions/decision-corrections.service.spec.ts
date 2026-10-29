import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { DecisionCorrectionsService } from "./decision-corrections.service"
import type { CorrectionRow } from "./persistence/corrections.rows"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"

const correctionRowOf = builder<CorrectionRow>({
    id: "decision-1",
    department: "sales",
    action: "send_follow_up",
    outcome: "edited",
    note: "Keep the deadline",
    created_at: "2026-10-15T09:15:00.000Z",
    before: { summary: "Follow up", draft: "Please pay", fields: { amount: 250 } },
    after: { summary: "Follow up", draft: "Please pay by Friday", fields: { amount: 250, due: "Friday" } },
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [DecisionCorrectionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(DecisionCorrectionsService)
}

describe("DecisionCorrectionsService", () => {
    describe("recent", () => {
        it("queries the workspace, module, inclusive instant and cap, preserving the database order", async () => {
            const newest = correctionRowOf()
            const older = correctionRowOf({
                id: "decision-2",
                outcome: "rejected",
                created_at: "2026-10-14T09:15:00.000Z",
                note: null,
                after: null,
            })
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [{ getRawMany: [newest, older] }])
            const service = await build(em)

            await expect(
                service.recent("workspace-1", "sales", new Date("2026-07-17T09:15:00.000Z"), 60),
            ).resolves.toEqual([
                {
                    decisionId: "decision-1",
                    action: newest.action,
                    outcome: "edited",
                    at: newest.created_at,
                    note: newest.note,
                    before: newest.before,
                    after: newest.after,
                },
                {
                    decisionId: "decision-2",
                    action: older.action,
                    outcome: "rejected",
                    at: older.created_at,
                    note: null,
                    before: older.before,
                    after: null,
                },
            ])
            expect(read?.callsOf("where")).toEqual([
                [
                    "d.workspaceId = :workspaceId AND d.department = :module",
                    { workspaceId: "workspace-1", module: "sales" },
                ],
            ])
            expect(read?.callsOf("andWhere")).toEqual([
                [
                    "d.outcome IN ('edited', 'rejected') AND d.createdAt >= :since",
                    { since: new Date("2026-07-17T09:15:00.000Z") },
                ],
            ])
            expect(read?.callsOf("orderBy")).toEqual([["d.createdAt", "DESC"]])
            expect(read?.callsOf("limit")).toEqual([[60]])
        })

        it("returns no corrections when the query finds none", async () => {
            const em = mockEntityManager()
            queueQueryBuilders(em, [{ getRawMany: [] }])
            const service = await build(em)

            await expect(
                service.recent("workspace-1", "accounting", new Date("2026-10-15T00:00:00.000Z"), 5),
            ).resolves.toEqual([])
        })

        it("propagates a database failure", async () => {
            const error = new DecisionsError({ code: DecisionsErrorCode.NotFound })
            const em = mockEntityManager()
            em.createQueryBuilder.mockImplementationOnce(() => {
                throw error
            })
            const service = await build(em)

            await expect(service.recent("workspace-1", "sales", new Date("2026-07-17T09:15:00.000Z"), 60)).rejects.toBe(
                error,
            )
        })
    })
})
