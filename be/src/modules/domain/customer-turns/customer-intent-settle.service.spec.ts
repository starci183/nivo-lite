import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { IntentPipelineService, IntentTurnService } from "@modules/domain/agent-turns"
import type { IntentPlan } from "@modules/domain/agent-turns"
import { CustomerIntentSettleService } from "./customer-intent-settle.service"

const SIGNAL = new AbortController().signal

const plan: IntentPlan = {
    versionId: "v-1",
    trigger: "customer_message",
    trust: "outsider",
    pinned: null,
    contracts: [],
}

const read: Awaited<ReturnType<IntentPipelineService["read"]>> = {
    reading: { kind: "safe", cause: "no_intent", detail: "none", intent: null, gap: null, draft: "" },
    trace: {
        versionId: "v-1",
        trigger: "customer_message",
        trust: "outsider",
        offered: [],
        intent: null,
        result: "no_intent",
        detail: "none",
        dropped: [],
    },
}

const build = async (found: IntentPlan | null, money: Readonly<Record<string, unknown>> | null = null) => {
    const intents = mock<IntentTurnService>({
        planFor: jest.fn().mockResolvedValue(found),
        filesOf: jest.fn().mockResolvedValue({ parts: [], attachments: [], money }),
    })
    const pipeline = mock<IntentPipelineService>({
        read: jest.fn().mockResolvedValue(read),
        door: jest.fn().mockResolvedValue({ replied: true, split: false }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerIntentSettleService,
            { provide: IntentTurnService, useValue: intents },
            { provide: IntentPipelineService, useValue: pipeline },
        ],
    }).compile()
    return { service: moduleRef.get(CustomerIntentSettleService), intents, pipeline }
}

describe("CustomerIntentSettleService", () => {
    it("keeps the text on the run, reads it and runs the customer door, ending the wake with the trace", async () => {
        const { service, pipeline, intents } = await build(plan)
        const turn = agentTurnViewOf({
            source: "customer",
            context: { intent: "confirm_order", conversationId: "c1", messageId: "m1" },
        })

        await expect(service.settle(turn, "envelope", SIGNAL)).resolves.toEqual({
            status: "done",
            reason: null,
            outcome: { replied: true, split: false, intent: read.trace },
        })

        expect(intents.planFor).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "customer",
            authorUserId: null,
            pinned: "confirm_order",
        })
        expect(pipeline.read).toHaveBeenCalledWith(turn, plan, "envelope", SIGNAL)
        expect(pipeline.door).toHaveBeenCalledWith(turn, "door", read, SIGNAL, {})
    })

    it("keeps the money evidence of the files of the message on the row of the door exactly as it was read", async () => {
        const money = { evidence: [{ amountVnd: 3_500_000 }], asked: true }
        const { service, pipeline } = await build(plan, money)
        const turn = agentTurnViewOf({ source: "customer", context: { conversationId: "c1", messageId: "m1" } })

        await service.settle(turn, "envelope", SIGNAL)

        expect(pipeline.door).toHaveBeenCalledWith(turn, "door", read, SIGNAL, { moneyText: JSON.stringify(money) })
    })

    it("answers null for a turn that is not on the pipeline, and writes no run", async () => {
        const { service, pipeline } = await build(null)

        await expect(service.settle(agentTurnViewOf({ source: "customer" }), "x", SIGNAL)).resolves.toBeNull()
        expect(pipeline.read).not.toHaveBeenCalled()
    })
})
