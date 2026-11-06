import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { itemOf } from "@tests/fixtures/builders/lead-flow-kit.builder"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { WorkEngineService } from "./work-engine.service"
import { WorkItemWithdrawExecutorService } from "./work-item-withdraw-executor.service"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}
const CALL = { key: "k", dedupeKey: null }

/** The executor the service registered; fails when it registered none. */
const registeredBy = (registry: GraphNodeRegistryService): NodeEffectExecutor => {
    const executor = jest.mocked(registry.addExecutor).mock.calls[0]?.[0]
    assert(executor !== undefined, "no executor was registered")
    return executor
}

const build = async () => {
    const engine = mock<WorkEngineService>()
    const registry = mock<GraphNodeRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkItemWithdrawExecutorService,
            { provide: WorkEngineService, useValue: engine },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    moduleRef.get(WorkItemWithdrawExecutorService).onModuleInit()
    return { engine, registry, executor: registeredBy(registry) }
}

const buildWithoutRegistry = async (): Promise<WorkItemWithdrawExecutorService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkItemWithdrawExecutorService,
            { provide: WorkEngineService, useValue: mock<WorkEngineService>() },
        ],
    }).compile()
    return moduleRef.get(WorkItemWithdrawExecutorService)
}

describe("WorkItemWithdrawExecutorService", () => {
    it("registers the work-item.withdraw executor, and nothing when the app hosts no graph nodes", async () => {
        const { executor } = await build()
        const bare = await buildWithoutRegistry()

        expect(executor.effect).toBe("work-item.withdraw")
        expect(() => bare.onModuleInit()).not.toThrow()
    })

    it("closes the work item that still waits as rejected, in the turn workspace", async () => {
        const { engine, executor } = await build()
        engine.resumeWork.mockResolvedValue(itemOf({ id: "item-1" }))

        await expect(executor.execute(TURN, { id: "item-1" }, CALL)).resolves.toEqual({
            kind: "work-item",
            id: "item-1",
        })

        expect(engine.resumeWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            "item-1",
            "rejected",
            {},
            { name: "NIVO", kind: "staff" },
        )
    })

    it("leaves a work item that was already decided, or is not in the workspace", async () => {
        const { engine, executor } = await build()
        engine.resumeWork.mockRejectedValue(new DecisionsError({ code: DecisionsErrorCode.NotWaiting }))

        await expect(executor.execute(TURN, { id: "item-1" }, CALL)).resolves.toEqual({
            kind: "work-item",
            id: "item-1",
        })
    })

    it("lets any other failure through, so the undo is tried again", async () => {
        const { engine, executor } = await build()
        const failure = new DecisionsError({ code: DecisionsErrorCode.WorkBusy })
        engine.resumeWork.mockRejectedValueOnce(failure).mockRejectedValueOnce(new Error("db down"))

        await expect(executor.execute(TURN, { id: "item-1" }, CALL)).rejects.toBe(failure)
        await expect(executor.execute(TURN, { id: "item-1" }, CALL)).rejects.toThrow("db down")
    })
})
