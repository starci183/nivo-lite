import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentRunItemClosedService } from "./agent-run-item-closed.service"
import type { AgentRunItemVerdicts } from "./agent-runs-engine.contracts"
import { AGENT_RUN_ITEM_VERDICTS } from "./agent-runs.decorators"
import type { StepDecision } from "./agent-runs.contracts"
import { AgentRunsService } from "./agent-runs.service"

type TransactionBody = (manager: EntityManager) => Promise<unknown>
type Isolation = Parameters<EntityManager["transaction"]>[0]

const build = async () => {
    const em = mockEntityManager()
    const tx = fakeTransaction(em)
    const managers: Array<EntityManager> = []
    const transact = em.transaction.getMockImplementation()
    assert(transact !== undefined)
    const observed = (first: Isolation | TransactionBody, second?: TransactionBody): Promise<unknown> => {
        const body = typeof first === "function" ? first : second
        assert(body !== undefined)
        const capture = (manager: EntityManager): Promise<unknown> => {
            expect(manager.queryRunner?.isTransactionActive).toBe(true)
            managers.push(manager)
            return body(manager)
        }
        return transact(typeof first === "function" ? "READ COMMITTED" : first, capture)
    }
    em.transaction.mockImplementation(observed)
    const verdicts: Array<string> = []
    const known = mock<AgentRunItemVerdicts>({
        verdictsOf: jest.fn().mockResolvedValue(
            new Map<string, StepDecision>([
                [
                    "item-1",
                    { approved: true, by: "member-1", data: { fields: { args_json: '{"qty":1}' }, draft: "Edited" } },
                ],
                ["item-2", { approved: false, by: "member-2", data: { fields: {}, draft: null } }],
            ]),
        ),
    })
    const runs = mock<AgentRunsService>({
        resumeWaiting: jest.fn((_workspaceId: string, _tx: unknown, itemId: string, decision: StepDecision) => {
            verdicts.push(`${itemId}:${String(decision.approved)}:${String(decision.by)}`)
            return Promise.resolve(true)
        }),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunItemClosedService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentRunsService, useValue: runs },
            { provide: AGENT_RUN_ITEM_VERDICTS, useValue: known },
        ],
    }).compile()
    return { service: container.get(AgentRunItemClosedService), verdicts, tx, known, runs, em, managers }
}

describe("AgentRunItemClosedService.closed", () => {
    it("finishes the wait on the item with the verdict and the person, in a transaction of its own", async () => {
        const { service, verdicts, tx, runs, em, managers } = await build()

        await service.closed("ws-1", "item-1", "approved", "Display name")
        await service.closed("ws-1", "item-2", "rejected", "Another display name")

        expect(verdicts).toEqual(["item-1:true:member-1", "item-2:false:member-2"])
        expect(tx.commits).toBe(2)
        const [first, second] = managers
        assert(first !== undefined)
        assert(second !== undefined)
        expect(first).not.toBe(em)
        expect(second).not.toBe(first)
        expect(first.queryRunner?.isTransactionActive).toBe(false)
        expect(second.queryRunner?.isTransactionActive).toBe(false)
        expect(runs.resumeWaiting).toHaveBeenNthCalledWith(1, "ws-1", first, "item-1", {
            approved: true,
            by: "member-1",
            data: { fields: { args_json: '{"qty":1}' }, draft: "Edited" },
        })
        expect(runs.resumeWaiting).toHaveBeenNthCalledWith(2, "ws-1", second, "item-2", {
            approved: false,
            by: "member-2",
            data: { fields: {}, draft: null },
        })
    })

    it("leaves a wait unchanged until its work item has a durable closed decision", async () => {
        const { service, known, runs, tx } = await build()
        known.verdictsOf.mockResolvedValueOnce(new Map())
        await service.closed("ws-1", "open-item", "approved", "member-1")
        expect(runs.resumeWaiting).not.toHaveBeenCalled()
        expect(tx.commits).toBe(0)
    })
})
