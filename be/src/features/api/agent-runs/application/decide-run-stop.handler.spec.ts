import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { StopDoorService } from "@modules/domain/agent-threads/stops"
import type { Principal } from "@modules/platform/cqrs"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideRunStopCommand } from "./decide-run-stop.command"
import { DecideRunStopHandler } from "./decide-run-stop.handler"
import type { DecideRunStopRequest } from "./decide-run-stop.contracts"

const PRINCIPAL = { id: "user-1" } as Principal

const REQUEST: DecideRunStopRequest = { workspaceId: "ws-1", runId: "run-1", stepKey: null, action: "answer", text: "Của DH-1" }

const build = async (withStops: boolean) => {
    const stops = mock<StopDoorService>({ decide: jest.fn().mockResolvedValue({ outcome: "admitted", stepKey: "match" }) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DecideRunStopHandler,
            { provide: LOGGER, useValue: mock<Logger>() },
            ...(withStops ? [{ provide: StopDoorService, useValue: stops }] : []),
        ],
    }).compile()
    return { handler: moduleRef.get(DecideRunStopHandler), stops }
}

describe("DecideRunStopHandler", () => {
    it("hands the person's decision to the stop door as theirs", async () => {
        const { handler, stops } = await build(true)

        await expect(handler.execute(new DecideRunStopCommand({ request: REQUEST, principal: PRINCIPAL }))).resolves.toEqual({
            outcome: "admitted",
            stepKey: "match",
        })
        expect(stops.decide).toHaveBeenCalledWith("user-1", REQUEST)
    })

    it("answers not_thread in an app that runs no thread", async () => {
        const { handler } = await build(false)

        await expect(handler.execute(new DecideRunStopCommand({ request: REQUEST, principal: PRINCIPAL }))).resolves.toEqual({
            outcome: "not_thread",
            stepKey: null,
        })
    })
})
