import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { IsNull, MoreThan, Not } from "typeorm"
import {
    decisionRow,
    stoppedDecisionRow,
    unbranchedDecisionRow,
    unfiledDecisionRow,
} from "@tests/fixtures/builders/agent-graph.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import type { NewDecision } from "./agent-graph-decisions.service"
import { AgentGraphDecisionEntity } from "./persistence/entities"

const RECORD: NewDecision = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    workItemId: "item-9",
    dedupeKey: null,
    road: "work",
    mode: "enforced",
    gateVerdict: "ask",
    versionId: "version-1",
    turnId: "turn-1",
    wakeId: "wake-1",
    action: "pay_supplier",
    path: ["decide", "ask"],
    facts: { "supplier_payment.amount_vnd": 7_200_000 },
    branchKey: "middle",
    outcome: "ask",
    shadowDiff: true,
    unread: ["order.amount_vnd"],
    unjudged: null,
    subjectType: null,
    subjectId: null,
    closedAs: null,
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
        expect(fake?.callsOf("values")).toEqual([
            [{ ...RECORD, path: ["decide", "ask"], facts: RECORD.facts, unread: ["order.amount_vnd"] }],
        ])
        expect(em.findOneByOrFail).toHaveBeenCalledWith(AgentGraphDecisionEntity, { workItemId: "item-9" })
    })

    it("finds a run that left no work item by its dedupe key", async () => {
        const em = mockEntityManager({
            findOneByOrFail: [AgentGraphDecisionEntity, unfiledDecisionRow()],
        })
        queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const service = await build(em)

        await expect(
            service.record({ ...RECORD, workItemId: null, dedupeKey: "reply:abc", road: "reply" }),
        ).resolves.toBe("decision-2")
        expect(em.findOneByOrFail).toHaveBeenCalledWith(AgentGraphDecisionEntity, { dedupeKey: "reply:abc" })
    })

    it("finds a run with neither a work item nor a dedupe key by an empty key, which matches nothing", async () => {
        const em = mockEntityManager({
            findOneByOrFail: [AgentGraphDecisionEntity, unfiledDecisionRow()],
        })
        queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const service = await build(em)

        await service.record({ ...RECORD, workItemId: null })

        expect(em.findOneByOrFail).toHaveBeenCalledWith(AgentGraphDecisionEntity, { dedupeKey: "" })
    })
})

describe("AgentGraphDecisionsService.close", () => {
    it("closes only a decision that is still open", async () => {
        const em = mockEntityManager({ update: [AgentGraphDecisionEntity, { affected: 1 }] })
        const service = await build(em)

        await service.close("item-9", "approved")

        expect(em.update).toHaveBeenCalledWith(
            AgentGraphDecisionEntity,
            { workItemId: "item-9", closedAs: IsNull() },
            { closedAs: "approved" },
        )
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
            versionId: "version-1",
            action: "pay_supplier",
            branchKey: "middle",
            path: ["decide", "middle"],
            amount: 7_200_000,
            approvalRequestId: "request-1",
            closed: true,
        }

        await expect(service.byId("decision-1")).resolves.toEqual(expected)
        await expect(service.byRequest("request-1")).resolves.toEqual(expected)
        await expect(service.byItem("item-9")).resolves.toEqual(expected)
        expect(em.findOneBy.mock.calls.map((call) => call[1])).toEqual([
            { id: "decision-1" },
            { approvalRequestId: "request-1" },
            { workItemId: "item-9" },
        ])
    })

    it("answers nothing for a decision of a run that left no work item", async () => {
        const em = mockEntityManager({
            findOneBy: [AgentGraphDecisionEntity, unfiledDecisionRow("decision-1")],
        })
        const service = await build(em)

        await expect(service.byId("decision-1")).resolves.toBeNull()
    })

    it("answers nothing for a decision that is not there, and names the request that is open for one", async () => {
        const em = mockEntityManager({
            findOneBy: [AgentGraphDecisionEntity, null],
            update: [AgentGraphDecisionEntity, { affected: 1 }],
        })
        const service = await build(em)

        await expect(service.byId("nothing")).resolves.toBeNull()
        await service.attachRequest("decision-1", "request-2")

        expect(em.update).toHaveBeenCalledWith(
            AgentGraphDecisionEntity,
            { id: "decision-1" },
            { approvalRequestId: "request-2" },
        )
    })
})

describe("AgentGraphDecisionsService.agentsClosedSince", () => {
    it("names each agent once that has a decision that ended since the moment", async () => {
        const rows = [decisionRow("d1", "approved"), decisionRow("d2", "rejected")]
        const em = mockEntityManager({ find: [AgentGraphDecisionEntity, rows] })
        const service = await build(em)
        const since = new Date("2026-10-30T00:00:00.000Z")

        await expect(service.agentsClosedSince(since, 500)).resolves.toEqual(["agent-1"])

        expect(em.find).toHaveBeenCalledWith(AgentGraphDecisionEntity, {
            select: { agentId: true },
            where: { closedAs: Not(IsNull()), updatedAt: MoreThan(since) },
            take: 500,
        })
    })
})

describe("AgentGraphDecisionsService.runOf", () => {
    it("reads the run of a work item: the version, the branch, how it ended and the facts", async () => {
        const em = mockEntityManager({ findOneBy: [AgentGraphDecisionEntity, decisionRow("decision-1", "approved")] })
        const service = await build(em)

        await expect(service.runOf("ws-1", "item-9")).resolves.toMatchObject({
            id: "decision-1",
            agentId: "agent-1",
            branchKey: "middle",
            closedAs: "approved",
            facts: { "supplier_payment.amount_vnd": 7_200_000 },
            path: ["decide", "middle"],
        })
        expect(em.findOneBy).toHaveBeenCalledWith(AgentGraphDecisionEntity, {
            workspaceId: "ws-1",
            workItemId: "item-9",
        })
    })

    it("answers nothing for a work item the graph never decided", async () => {
        const service = await build(mockEntityManager({ findOneBy: [AgentGraphDecisionEntity, null] }))

        await expect(service.runOf("ws-1", "item-9")).resolves.toBeNull()
    })
})

describe("AgentGraphDecisionsService.runsOf", () => {
    it("lists the latest runs newest first, with what the graph did and whether it differed from the gate", async () => {
        const em = mockEntityManager({
            find: [AgentGraphDecisionEntity, [stoppedDecisionRow("d2"), unfiledDecisionRow("d1")]],
        })
        const service = await build(em)

        await expect(service.runsOf("ws-1", "agent-1", 30)).resolves.toEqual([
            {
                id: "d2",
                road: "work",
                mode: "enforced",
                action: "pay_supplier",
                versionId: "version-1",
                branchKey: "middle",
                outcome: "stop",
                gateVerdict: "ask",
                closedAs: "stopped",
                differs: true,
                unread: [],
                unjudged: null,
                facts: { "order.amount_vnd": 9 },
                path: ["decide", "middle"],
                workItemId: "item-9",
                subjectType: null,
                subjectId: null,
                createdAt: "2026-11-01T01:00:00.000Z",
            },
            expect.objectContaining({ id: "d1", road: "reply", gateVerdict: null, workItemId: null, differs: false }),
        ])
        expect(em.find).toHaveBeenCalledWith(AgentGraphDecisionEntity, {
            where: { workspaceId: "ws-1", agentId: "agent-1" },
            order: { createdAt: "DESC", id: "DESC" },
            take: 30,
        })
    })
})

describe("AgentGraphDecisionsService.closedOf", () => {
    it("reads the closed decisions oldest first with the amount that was read, and skips the ones still open, the ones a stop closed and the ones no branch took", async () => {
        const em = mockEntityManager({
            find: [
                AgentGraphDecisionEntity,
                [
                    unbranchedDecisionRow("d5"),
                    stoppedDecisionRow("d4"),
                    decisionRow("d3", null),
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
        expect(em.find).toHaveBeenCalledWith(
            AgentGraphDecisionEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", agentId: "agent-1" }, take: 200 }),
        )
    })
})
