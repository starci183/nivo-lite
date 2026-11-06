import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { itemOf } from "@tests/fixtures/builders/lead-flow-kit.builder"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { WorkEngineService } from "./work-engine.service"
import { WorkItemRaiseExecutorService } from "./work-item-raise-executor.service"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: "conv-1",
    locale: "vi",
}

/** The executor the service registered. */
const registeredBy = (registry: GraphNodeRegistryService): NodeEffectExecutor => {
    const executor = jest.mocked(registry.addExecutor).mock.calls[0]?.[0]
    assert(executor !== undefined, "no executor was registered")
    return executor
}

const build = async (options: { installed?: boolean } = {}) => {
    const engine = mock<WorkEngineService>()
    engine.runWork.mockResolvedValue(itemOf({ id: "item-1" }))
    const installations = mock<InstallationRecordsService>()
    installations.ofAgent.mockResolvedValue(
        options.installed === false ? null : mock<InstallationRecord>({ moduleKey: "sales" }),
    )
    const registry = mock<GraphNodeRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkItemRaiseExecutorService,
            { provide: WorkEngineService, useValue: engine },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    moduleRef.get(WorkItemRaiseExecutorService).onModuleInit()
    return { engine, registry, executor: registeredBy(registry) }
}

const buildWithoutRegistry = async (): Promise<WorkItemRaiseExecutorService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkItemRaiseExecutorService,
            { provide: WorkEngineService, useValue: mock<WorkEngineService>() },
            { provide: InstallationRecordsService, useValue: mock<InstallationRecordsService>() },
        ],
    }).compile()
    return moduleRef.get(WorkItemRaiseExecutorService)
}

describe("WorkItemRaiseExecutorService", () => {
    it("registers the work-item.raise executor, and nothing when the app hosts no graph nodes", async () => {
        const { executor } = await build()
        const bare = await buildWithoutRegistry()

        expect(executor.effect).toBe("work-item.raise")
        expect(() => bare.onModuleInit()).not.toThrow()
    })

    it("opens an item that waits for the owner, about the order, once per business key", async () => {
        const { engine, executor } = await build()

        const subject = await executor.execute(
            TURN,
            {
                action: "confirm_order",
                title: "Order waits",
                payload: { orderId: "o1", leadId: "lead-1", total: 5000000, flag: true, note: null },
                amountVnd: 5000000,
            },
            { key: "run:1", dedupeKey: "order-owner:o1" },
        )

        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            {
                action: "confirm_order",
                department: "sales",
                subject_type: "order",
                subject_id: "o1",
                lead_id: "lead-1",
                dedupeKey: "graph-node:work-item.raise:order-owner:o1",
                seed: {
                    summary: "Order waits",
                    amount_vnd: 5000000,
                    fields: { orderId: "o1", leadId: "lead-1", total: 5000000, note: null },
                },
                preset: true,
                forceAsk: "branch_ask",
            },
        )
        expect(subject).toEqual({ kind: "work-item", id: "item-1" })
    })

    it("keys the item by the call when the node gave no business key, and by the customer or the conversation when no order is named", async () => {
        const { engine, executor } = await build()

        await executor.execute(
            TURN,
            { action: "connect_sepay", title: "Connect", payload: { leadId: "lead-1" } },
            { key: "run:2", dedupeKey: null },
        )
        await executor.execute(
            TURN,
            { action: "connect_sepay", title: "Connect", payload: {} },
            { key: "run:3", dedupeKey: null },
        )

        const [first, second] = engine.runWork.mock.calls.map(([, spec]) => spec)
        expect(first).toMatchObject({
            subject_type: "lead",
            subject_id: "lead-1",
            dedupeKey: "graph-node:work-item.raise:run:2",
        })
        expect(first?.seed?.amount_vnd).toBeNull()
        expect(second).toMatchObject({ subject_type: "conversation", subject_id: "conv-1", lead_id: null })
    })
})

describe("WorkItemRaiseExecutorService for an agent with no installation", () => {
    it("names no department, so only a listed action can be raised", async () => {
        const { engine, executor } = await build({ installed: false })

        await executor.execute(
            TURN,
            { action: "review_agent_run", title: "Review", payload: {} },
            { key: "k", dedupeKey: null },
        )

        expect(engine.runWork.mock.calls[0]?.[1]).not.toHaveProperty("department")
    })
})
