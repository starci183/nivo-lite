import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DecisionCorrectionsService } from "./decision-corrections.service"
import type { CorrectionRow } from "./persistence/corrections.rows"
import { LIST_RECENT_CORRECTIONS } from "./persistence/corrections.sql"

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
            const em = mockEntityManager({ query: [LIST_RECENT_CORRECTIONS, [newest, older]] })
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
            expect(em.query).toHaveBeenCalledWith(LIST_RECENT_CORRECTIONS, [
                "workspace-1",
                "sales",
                "2026-07-17T09:15:00.000Z",
                60,
            ])
        })

        it("returns no corrections when the query finds none", async () => {
            const service = await build(mockEntityManager({ query: [LIST_RECENT_CORRECTIONS, []] }))

            await expect(
                service.recent("workspace-1", "accounting", new Date("2026-10-15T00:00:00.000Z"), 5),
            ).resolves.toEqual([])
        })

        it("propagates a database failure", async () => {
            const error = new Error("Decision query failed")
            const em = mockEntityManager()
            em.query.mockRejectedValueOnce(error)
            const service = await build(em)

            await expect(service.recent("workspace-1", "sales", new Date("2026-07-17T09:15:00.000Z"), 60)).rejects.toBe(
                error,
            )
        })
    })
})
