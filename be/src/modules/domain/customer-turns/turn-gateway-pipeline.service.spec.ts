import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runtimeTurn } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import type { ToolContext } from "@modules/domain/agent-tools"
import { IntentTurnService } from "@modules/domain/agent-turns"
import { toolResultOf } from "@modules/domain/intent-contracts"
import { TurnGatewayPipelineService } from "./turn-gateway-pipeline.service"

const { conversation } = runtimeTurn

const ctx = (pinnedIntent?: string | null): ToolContext => ({
    jobId: "m1",
    workspaceId: "ws-1",
    conversationId: "c1",
    ...(pinnedIntent === undefined ? {} : { pinnedIntent }),
})

const build = async (pipeline: boolean) => {
    const intents = mock<IntentTurnService>({ pipelineOf: jest.fn().mockResolvedValue(pipeline) })
    const moduleRef = await Test.createTestingModule({
        providers: [TurnGatewayPipelineService, { provide: IntentTurnService, useValue: intents }],
    }).compile()
    return { service: moduleRef.get(TurnGatewayPipelineService), intents }
}

describe("TurnGatewayPipelineService.gateOf", () => {
    it("asks nothing of the pipeline for a per-job token, which names no pin, and never refuses a write", async () => {
        const { service, intents } = await build(true)

        await expect(service.gateOf(ctx(), conversation)).resolves.toEqual({ on: false, refuses: false })
        expect(intents.pipelineOf).not.toHaveBeenCalled()
    })

    it("refuses the writes of a bridge turn on the pipeline that is not pinned, with the scope of its conversation", async () => {
        const { service, intents } = await build(true)

        await expect(service.gateOf(ctx(null), conversation)).resolves.toEqual({ on: true, refuses: true })
        expect(intents.pipelineOf).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "a1",
            source: "customer",
            authorUserId: null,
            pinned: null,
        })
    })

    it("lets the turn pinned to an intent write", async () => {
        const { service } = await build(true)

        await expect(service.gateOf(ctx("confirm_order"), conversation)).resolves.toEqual({ on: true, refuses: false })
    })

    it("leaves a bridge turn the graph holds no contracts for exactly as it was", async () => {
        const { service } = await build(false)

        await expect(service.gateOf(ctx(null), conversation)).resolves.toEqual({ on: false, refuses: false })
    })
})

describe("TurnGatewayPipelineService.resultOf", () => {
    it("hands a result over as marked data on the pipeline", async () => {
        const { service } = await build(true)

        expect(service.resultOf({ on: true, refuses: false }, { orderId: "o1" })).toEqual({
            result: toolResultOf({ orderId: "o1" }),
        })
    })

    it("hands it over unchanged off the pipeline", async () => {
        const { service } = await build(false)

        expect(service.resultOf({ on: false, refuses: false }, { orderId: "o1" })).toEqual({
            result: { orderId: "o1" },
        })
    })
})
