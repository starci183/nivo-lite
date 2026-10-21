import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LeadGenQueue } from "@modules/queues/lead-gen"
import { LeadFlowChainService } from "./lead-flow-chain.service"

const NOW = "2026-10-12T10:00:00.000Z"
const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "lead_gen",
    action: "score_lead",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: "event-1",
    parent_id: null,
    chain_id: "chain-1",
    depth: 1,
    status: "done",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Scored", fields: { step: "greet", turn: "t:1" }, draft: "Hello" },
    result: null,
    error: null,
    evidence_state: "captured",
    assigned_staff_id: null,
    execution_id: null,
    created_at: NOW,
    updated_at: NOW,
    completed_at: NOW,
    installation_id: null,
})

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const queue = mock<LeadGenQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFlowChainService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: LeadGenQueue, useValue: queue },
        ],
    }).compile()
    return { chain: moduleRef.get(LeadFlowChainService), tx, queue }
}

describe("LeadFlowChainService", () => {
    it("queues the continuation of a finished step in its own transaction", async () => {
        const { chain, tx, queue } = await build()

        await expect(chain.continueAfter(ctx, itemOf())).resolves.toBeUndefined()

        const manager = queue.enqueue.mock.calls[0]?.[1]
        expect(isTransactionManager(manager)).toBe(true)
        expect(queue.enqueue.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    locale: "vi",
                    inboundEventId: "event-1",
                    step: {
                        id: "item-1",
                        action: "score_lead",
                        leadId: "lead-1",
                        chainId: "chain-1",
                        fields: { step: "greet", turn: "t:1" },
                        draft: "Hello",
                    },
                },
                manager,
            ],
        ])
        expect(tx.commits).toBe(1)
    })

    it("carries an empty draft and rolls back when the queue write fails", async () => {
        const { chain, tx, queue } = await build()
        const failure = new Error("queue unavailable")
        queue.enqueue.mockRejectedValue(failure)
        const item = itemOf({ proposal: { summary: "Captured", fields: {} } })

        await expect(chain.continueAfter(ctx, item)).rejects.toBe(failure)

        expect(queue.enqueue.mock.calls[0]?.[0].step.draft).toBe("")
        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
    })
})
