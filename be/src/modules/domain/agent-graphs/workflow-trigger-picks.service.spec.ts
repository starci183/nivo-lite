import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { agentGraphsEntities } from "./persistence/entities"
import { WorkflowTriggerPicksService } from "./workflow-trigger-picks.service"

/**
 * The store of the founder's picks of ONE source per contested stream (owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12):
 * one row per (workspace, workflow, verb, stream), apart from any graph version so a pick survives a re-publish.
 */

const [WorkflowTriggerPickEntity] = agentGraphsEntities
const WS = "ws-1"
const NOW = new Date("2026-11-13T02:00:00.000Z")

const build = async () => {
    const entityManager: MockEntityManager = mockEntityManager({ upsert: [WorkflowTriggerPickEntity, {}] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkflowTriggerPicksService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { picks: moduleRef.get(WorkflowTriggerPicksService), entityManager }
}

describe("WorkflowTriggerPicksService", () => {
    it("reads the picks of one workflow of an agent, as readiness takes them", async () => {
        const { picks, entityManager } = await build()
        entityManager.find.mockResolvedValueOnce([
            { verb: "nivo.trigger.payment.credit.received", stream: "bank-account:VCB:111", connectionId: "c1" },
        ])
        expect(await picks.picksOf(WS, "agent-1", "wf-1")).toEqual([
            { verb: "nivo.trigger.payment.credit.received", stream: "bank-account:VCB:111", connectionId: "c1" },
        ])
        expect(entityManager.find).toHaveBeenCalledWith(WorkflowTriggerPickEntity, {
            select: { verb: true, stream: true, connectionId: true },
            where: { workspaceId: WS, agentId: "agent-1", workflowId: "wf-1" },
            order: { verb: "ASC", stream: "ASC" },
            take: 200,
        })
    })

    it("writes one row per workflow, verb and stream: a new pick of the same stream replaces the old", async () => {
        const { picks, entityManager } = await build()
        const written = await picks.record(WS, "agent-1", "member-1", [
            { workflowId: "wf-1", verb: "nivo.trigger.payment.credit.received", stream: "bank-account:VCB:111", connectionId: "c1" },
        ])
        expect(written).toBe(1)
        expect(entityManager.upsert).toHaveBeenCalledWith(
            WorkflowTriggerPickEntity,
            [
                {
                    workspaceId: WS,
                    agentId: "agent-1",
                    workflowId: "wf-1",
                    verb: "nivo.trigger.payment.credit.received",
                    stream: "bank-account:VCB:111",
                    connectionId: "c1",
                    pickedBy: "member-1",
                    pickedAt: NOW,
                },
            ],
            ["workspaceId", "workflowId", "verb", "stream"],
        )
    })

    it("writes nothing for no pick", async () => {
        const { picks, entityManager } = await build()
        expect(await picks.record(WS, "agent-1", "member-1", [])).toBe(0)
        expect(entityManager.upsert).not.toHaveBeenCalled()
    })
})
