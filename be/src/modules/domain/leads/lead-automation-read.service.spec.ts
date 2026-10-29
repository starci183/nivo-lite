import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { LeadAutomationReadService } from "./lead-automation-read.service"

const build = async (answers: ReadonlyArray<QueryBuilderAnswers>) => {
    const entityManager = mockEntityManager()
    const fakes = queueQueryBuilders(entityManager, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [LeadAutomationReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(LeadAutomationReadService), fakes, entityManager }
}

const SCAN = { workspaceId: "ws-1", since: "2026-10-01T00:00:00.000Z", limit: 200 }

describe("LeadAutomationReadService", () => {
    it("reads one lead of the workspace", async () => {
        const row = { id: "l1", contact_name: "An" }
        const { service, fakes } = await build([{ getRawOne: row }])

        await expect(service.lead("ws-1", "l1")).resolves.toBe(row)
        expect(fakes[0]?.callsOf("where")).toEqual([
            ["l.workspace_id = :workspaceId AND l.id = :leadId", { workspaceId: "ws-1", leadId: "l1" }],
        ])
        expect(fakes[0]?.callsOf("limit")).toEqual([[1]])
    })

    it("scans the leads of some stages, newest first", async () => {
        const rows = [{ id: "l1", stage: "new", created_at: "2026-10-02T00:00:00.000Z" }]
        const { service, fakes } = await build([{ getRawMany: rows }])

        await expect(service.scanLeads({ ...SCAN, stages: ["new"], except: null })).resolves.toBe(rows)
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["l.stage = ANY(:stages)", { stages: ["new"] }]])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["l.created_at", "DESC"]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[200]])
    })

    it("scans every stage but the one left out", async () => {
        const { service, fakes } = await build([{ getRawMany: [] }])

        await expect(service.scanLeads({ ...SCAN, stages: null, except: "lost" })).resolves.toEqual([])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["l.stage <> :except", { except: "lost" }]])
    })

    it("counts the leads created from an instant on, zero when nothing answers", async () => {
        const { service, entityManager } = await build([{ getRawOne: { count: 3 } }, { getRawOne: undefined }])

        await expect(service.countCreatedSince("ws-1", "2026-10-12", entityManager)).resolves.toBe(3)
        await expect(service.countCreatedSince("ws-1", "2026-10-12", entityManager)).resolves.toBe(0)
    })

    it("counts the won leads among some, and asks nothing for none", async () => {
        const { service, entityManager, fakes } = await build([{ getRawOne: { count: 2 } }, { getRawOne: undefined }])

        await expect(service.countWonAmong("ws-1", [], entityManager)).resolves.toBe(0)
        expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
        await expect(service.countWonAmong("ws-1", ["l1"], entityManager)).resolves.toBe(2)
        await expect(service.countWonAmong("ws-1", ["l1"], entityManager)).resolves.toBe(0)
        expect(fakes[0]?.callsOf("where")).toEqual([
            [
                "l.workspace_id = :workspaceId AND l.stage = 'won' AND l.id = ANY(:leadIds::uuid[])",
                { workspaceId: "ws-1", leadIds: ["l1"] },
            ],
        ])
    })
})
