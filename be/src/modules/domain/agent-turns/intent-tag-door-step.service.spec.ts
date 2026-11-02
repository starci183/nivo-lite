import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { AgentStepHandler } from "@modules/domain/agent-runs"
import { IntentRequestDoorService } from "./intent-request-door.service"
import { IntentTagDoorStepService } from "./intent-tag-door-step.service"

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
            IntentTagDoorStepService,
            { provide: AgentRunHandlersService, useValue: handlers },
            { provide: IntentRequestDoorService, useValue: requests },
        ],
    }).compile()
    return { service: moduleRef.get(IntentTagDoorStepService), added, requests }
}

describe("IntentTagDoorStepService", () => {
    it("registers the persisted tag_door kind and applies its exact row through the common request owner", async () => {
        const { service, added, requests } = await build()
        const step = stepViewOf({ kind: "tag_door" })
        service.onModuleInit()

        expect(added.map((handler) => handler.kind)).toEqual(["tag_door"])
        await expect(added[0]?.run(step, new AbortController().signal)).resolves.toEqual({
            kind: "done",
            result: { settled: true },
            next: [],
        })
        expect(requests.apply).toHaveBeenCalledWith(step)
    })
})
