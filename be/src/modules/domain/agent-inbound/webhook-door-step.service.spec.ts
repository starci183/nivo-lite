import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { AgentStepHandler } from "@modules/domain/agent-runs"
import { IntentRequestDoorService } from "@modules/domain/agent-turns"
import { WebhookDoorStepService } from "./webhook-door-step.service"

const build = async () => {
    const added: Array<AgentStepHandler> = []
    const handlers = mock<AgentRunHandlersService>({
        add: jest.fn((handler: AgentStepHandler) => void added.push(handler)),
    })
    const requests = mock<IntentRequestDoorService>({
        apply: jest.fn().mockResolvedValue({ kind: "done", result: { settled: true }, next: [] }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebhookDoorStepService,
            { provide: AgentRunHandlersService, useValue: handlers },
            { provide: IntentRequestDoorService, useValue: requests },
        ],
    }).compile()
    return { service: moduleRef.get(WebhookDoorStepService), added, requests }
}

describe("WebhookDoorStepService", () => {
    it("registers the persisted webhook_door kind and applies its exact row through the common request owner", async () => {
        const { service, added, requests } = await build()
        const step = stepViewOf({ kind: "webhook_door" })
        service.onModuleInit()

        expect(added.map((handler) => handler.kind)).toEqual(["webhook_door"])
        await expect(added[0]?.run(step, new AbortController().signal)).resolves.toEqual({
            kind: "done",
            result: { settled: true },
            next: [],
        })
        expect(requests.apply).toHaveBeenCalledWith(step)
    })
})
