import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import { decisionRow } from "@tests/fixtures/builders/agent-graph.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import type { DecisionRecord } from "./agent-graph-decisions.service"
import { AgentGraphDecisionEntity } from "./persistence/entities"

const RECORD: DecisionRecord = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    workItemId: "item-9",
    versionId: "version-1",
    turnId: "turn-1",
    wakeId: "wake-1",
    action: "pay_supplier",
    path: ["decide", "ask"],
    facts: { "supplier_payment.amount_vnd": 7_200_000 },
    branchKey: "middle",
    outcome: "ask",
    shadowDiff: true,
}

const MODEL_ONLY = { "model.amount_vnd": 5, note: "x" }

const build = async (em = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentGraphDecisionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(AgentGraphDecisionsService)
}

describe("AgentGraphDecisionsService.record", () => {
    it("writes the decision of an item once and answers its id, so a retry gets the row that is already there", async () => {
        const em = mockEntityManager({ findOneByOrFail: [AgentGraphDecisionEntity, decisionRow()] })
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [] } }, { execute: { raw: [] } }])
        const service = await build(em)

        await expect(service.record(RECORD)).resolves.toBe("decision-1")
        await expect(service.record(RECORD)).resolves.toBe("decision-1")

        expect(fake?.callsOf("orIgnore")).toEqual([[]])
        expect(fake?.callsOf("values")).toEqual([[{ ...RECORD, path: ["decide", "ask"], facts: RECORD.facts }]])
        expect(em.findOneByOrFail).toHaveBeenCalledWith(AgentGraphDecisionEntity, { workItemId: "item-9" })
    })
})

describe("AgentGraphDecisionsService.close", () => {
    it("closes only a decision that is still open", async () => {
        const em = mockEntityManager({ update: [AgentGraphDecisionEntity, { affected: 1 }] })
        const service = await build(em)

        await service.close("item-9", "approved")

        expect(em.update).toHaveBeenCalledWith(AgentGraphDecisionEntity, { workItemId: "item-9", closedAs: IsNull() }, { closedAs: "approved" })
    })
})

describe("AgentGraphDecisionsService lookups", () => {
    it("reads a decision by its id, its open request or its work item, with the amount that was read", async () => {
        const em = mockEntityManager({ findOneBy: [AgentGraphDecisionEntity, decisionRow("decision-1", "approved")] })
        const service = await build(em)
        const expected = {
            id: "decision-1",
            workspaceId: "ws-1",
            agentId: "agent-1",
            workItemId: "item-9",
            versionId: undefined,
            action: undefined,
            branchKey: "middle",
            amount: 7_200_000,
            approvalRequestId: undefined,
            closed: true,
        }

        await expect(service.byId("decision-1")).resolves.toEqual(expected)
        await expect(service.byRequest("request-1")).resolves.toEqual(expected)
        await expect(service.byItem("item-9")).resolves.toEqual(expected)
        expect(em.findOneBy.mock.calls.map((call) => call[1])).toEqual([{ id: "decision-1" }, { approvalRequestId: "request-1" }, { workItemId: "item-9" }])
    })

    it("answers nothing for a decision that is not there, and names the request that is open for one", async () => {
        const em = mockEntityManager({ findOneBy: [AgentGraphDecisionEntity, null], update: [AgentGraphDecisionEntity, { affected: 1 }] })
        const service = await build(em)

        await expect(service.byId("nothing")).resolves.toBeNull()
        await service.attachRequest("decision-1", "request-2")

        expect(em.update).toHaveBeenCalledWith(AgentGraphDecisionEntity, { id: "decision-1" }, { approvalRequestId: "request-2" })
    })
})

describe("AgentGraphDecisionsService.closedOf", () => {
    it("reads the closed decisions oldest first with the amount that was read, and skips the ones still open", async () => {
        const em = mockEntityManager({
            find: [
                AgentGraphDecisionEntity,
                [
                    decisionRow("d3"),
                    decisionRow("d2", "rejected", MODEL_ONLY),
                    decisionRow("d1", "approved"),
                ],
            ],
        })
        const service = await build(em)

        await expect(service.closedOf("ws-1", "agent-1")).resolves.toEqual([
            { id: "d1", branchKey: "middle", closedAs: "approved", amount: 7_200_000 },
            { id: "d2", branchKey: "middle", closedAs: "rejected", amount: null },
        ])
        expect(em.find).toHaveBeenCalledWith(AgentGraphDecisionEntity, expect.objectContaining({ where: { workspaceId: "ws-1", agentId: "agent-1" }, take: 200 }))
    })
})
