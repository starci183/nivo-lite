import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { EntityEngineService } from "@modules/domain/entity-engine"
import {
    decisionRow,
    stoppedDecisionRow,
    unbranchedDecisionRow,
    unfiledDecisionRow,
} from "@tests/fixtures/builders/agent-graph.builder"
import { SCOPE, wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import type { NewDecision } from "./agent-graph-decisions.service"
import { AgentGraphRecordsService } from "./agent-graph-records.service"

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

const build = async () => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const records = mock<AgentGraphRecordsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphDecisionsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentGraphRecordsService, useValue: records },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphDecisionsService), engine, records }
}

describe("AgentGraphDecisionsService.record", () => {
    it("writes the decision of an item once under its work item and answers the id of the record that stands", async () => {
        const { service, engine, records } = await build()
        records.recordDecision.mockResolvedValue(decisionRow())

        await expect(service.record(RECORD)).resolves.toBe("decision-1")
        await expect(service.record(RECORD)).resolves.toBe("decision-1")

        expect(engine.scoped).toHaveBeenCalledWith("ws-1", expect.any(Function))
        expect(records.recordDecision).toHaveBeenCalledWith(
            SCOPE,
            "work_item",
            expect.objectContaining({
                agentId: "agent-1",
                workItemId: "item-9",
                dedupeKey: null,
                unread: { keys: ["order.amount_vnd"] },
                path: { keys: ["decide", "ask"] },
                facts: { "supplier_payment.amount_vnd": 7_200_000 },
                shadowDiff: true,
            }),
        )
    })

    it("writes a run that left no work item under its dedupe key", async () => {
        const { service, records } = await build()
        records.recordDecision.mockResolvedValue(unfiledDecisionRow())

        await expect(
            service.record({ ...RECORD, workItemId: null, dedupeKey: "reply:abc", road: "reply" }),
        ).resolves.toBe("decision-2")

        expect(records.recordDecision).toHaveBeenCalledWith(
            SCOPE,
            "dedupe",
            expect.objectContaining({ dedupeKey: "reply:abc", workItemId: null }),
        )
    })
})

describe("AgentGraphDecisionsService.close", () => {
    it("closes only a decision that is still open", async () => {
        const { service, records } = await build()
        records.decisionOfItem.mockResolvedValueOnce(decisionRow("decision-1", null))

        await service.close("ws-1", "item-9", "approved")

        expect(records.patchDecision).toHaveBeenCalledWith(SCOPE, expect.objectContaining({ id: "decision-1" }), {
            closedAs: "approved",
        })
    })

    it("leaves an item with no decision, and a decision already closed, alone", async () => {
        const { service, records } = await build()
        records.decisionOfItem.mockResolvedValueOnce(null).mockResolvedValueOnce(decisionRow("decision-1", "approved"))

        await service.close("ws-1", "item-9", "rejected")
        await service.close("ws-1", "item-9", "rejected")

        expect(records.patchDecision).not.toHaveBeenCalled()
    })

    it("closes on the caller's own transaction when it is given one", async () => {
        const { service, engine, records } = await build()
        const manager = mockEntityManager()
        records.decisionOfItem.mockResolvedValueOnce(decisionRow("decision-1", null))

        await service.close("ws-1", "item-9", "expired", manager)

        expect(engine.within).toHaveBeenCalledWith(manager, "ws-1", expect.any(Function))
        expect(engine.scoped).not.toHaveBeenCalled()
    })
})

describe("AgentGraphDecisionsService lookups", () => {
    it("reads a decision by its id, its open request or its work item, with the amount that was read", async () => {
        const { service, records } = await build()
        const row = decisionRow("decision-1", "approved")
        records.decision.mockResolvedValue(row)
        records.decisionOfRequest.mockResolvedValue(row)
        records.decisionOfItem.mockResolvedValue(row)
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

        await expect(service.byId("ws-1", "decision-1")).resolves.toEqual(expected)
        await expect(service.byRequest("ws-1", "request-1")).resolves.toEqual(expected)
        await expect(service.byItem("ws-1", "item-9")).resolves.toEqual(expected)
        expect(records.decision).toHaveBeenCalledWith(SCOPE, "decision-1")
        expect(records.decisionOfRequest).toHaveBeenCalledWith(SCOPE, "request-1")
        expect(records.decisionOfItem).toHaveBeenCalledWith(SCOPE, "item-9")
    })

    it("looks a decision up on the caller's own transaction when it is given one", async () => {
        const { service, engine, records } = await build()
        const manager = mockEntityManager()
        records.decisionOfRequest.mockResolvedValue(null)
        records.decisionOfItem.mockResolvedValue(null)

        await service.byRequest("ws-1", "request-1", manager)
        await service.byItem("ws-1", "item-9", manager)

        expect(engine.within).toHaveBeenCalledTimes(2)
    })

    it("answers nothing for a decision of a run that left no work item, or one that is not there", async () => {
        const { service, records } = await build()
        records.decision.mockResolvedValueOnce(unfiledDecisionRow("decision-1")).mockResolvedValueOnce(null)

        await expect(service.byId("ws-1", "decision-1")).resolves.toBeNull()
        await expect(service.byId("ws-1", "nothing")).resolves.toBeNull()
    })

    it("names the request that is open for a decision, and ignores a decision that is not there", async () => {
        const { service, records } = await build()
        records.decision.mockResolvedValueOnce(decisionRow("decision-1")).mockResolvedValueOnce(null)

        await service.attachRequest("ws-1", "decision-1", "request-2")
        await service.attachRequest("ws-1", "nothing", "request-2")

        expect(records.patchDecision).toHaveBeenCalledTimes(1)
        expect(records.patchDecision).toHaveBeenCalledWith(SCOPE, expect.objectContaining({ id: "decision-1" }), {
            approvalRequestId: "request-2",
        })
    })
})

describe("AgentGraphDecisionsService.agentsClosedSince", () => {
    it("names each agent once that has a decision that ended since the moment", async () => {
        const { service, records } = await build()
        records.decisionsClosedSince.mockResolvedValue([decisionRow("d1", "approved"), decisionRow("d2", "rejected")])
        const since = new Date("2026-10-30T00:00:00.000Z")

        await expect(service.agentsClosedSince("ws-1", since, 500)).resolves.toEqual(["agent-1"])

        expect(records.decisionsClosedSince).toHaveBeenCalledWith(SCOPE, since, 500)
    })
})

describe("AgentGraphDecisionsService.runOf", () => {
    it("reads the run of a work item: the version, the branch, how it ended and the facts", async () => {
        const { service, records } = await build()
        records.decisionOfItem.mockResolvedValue(decisionRow("decision-1", "approved"))

        await expect(service.runOf("ws-1", "item-9")).resolves.toMatchObject({
            id: "decision-1",
            agentId: "agent-1",
            branchKey: "middle",
            closedAs: "approved",
            facts: { "supplier_payment.amount_vnd": 7_200_000 },
            path: ["decide", "middle"],
        })
    })

    it("answers nothing for a work item the graph never decided", async () => {
        const { service, records } = await build()
        records.decisionOfItem.mockResolvedValue(null)

        await expect(service.runOf("ws-1", "item-9")).resolves.toBeNull()
    })
})

describe("AgentGraphDecisionsService.runsOf", () => {
    it("lists the latest runs newest first, with what the graph did and whether it differed from the gate", async () => {
        const { service, records } = await build()
        records.decisionsOf.mockResolvedValue([stoppedDecisionRow("d2"), unfiledDecisionRow("d1")])

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
        expect(records.decisionsOf).toHaveBeenCalledWith(SCOPE, "agent-1", 30)
    })
})

describe("AgentGraphDecisionsService.closedOf", () => {
    it("reads the closed decisions oldest first with the amount that was read, and skips the ones still open, the ones a stop closed and the ones no branch took", async () => {
        const { service, records } = await build()
        records.decisionsOf.mockResolvedValue([
            unbranchedDecisionRow("d5"),
            stoppedDecisionRow("d4"),
            decisionRow("d3", null),
            decisionRow("d2", "rejected", MODEL_ONLY),
            decisionRow("d1", "approved"),
        ])

        await expect(service.closedOf("ws-1", "agent-1")).resolves.toEqual([
            { id: "d1", branchKey: "middle", closedAs: "approved", amount: 7_200_000 },
            { id: "d2", branchKey: "middle", closedAs: "rejected", amount: null },
        ])
        expect(records.decisionsOf).toHaveBeenCalledWith(SCOPE, "agent-1", 200)
    })
})
