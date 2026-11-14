import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { StopDoorService, type StopDoorAnswer } from "@modules/domain/agent-threads"
import { RunStopDecisionsService } from "./run-stop-decisions.service"

const ADMITTED: StopDoorAnswer = { outcome: "admitted", stepKey: "send-qr" }

describe("RunStopDecisionsService.decide", () => {
    it("hands the decision to the stop door as the member, naming the run, the step, the action and the words", async () => {
        const door = mock<StopDoorService>({ decide: jest.fn().mockResolvedValue(ADMITTED) })
        const container = await Test.createTestingModule({
            providers: [RunStopDecisionsService, { provide: StopDoorService, useValue: door }],
        }).compile()

        await expect(
            container.get(RunStopDecisionsService).decide("user-1", "ws-1", "run-1", "send-qr", "answer", "Gui lai"),
        ).resolves.toBe(ADMITTED)
        expect(door.decide).toHaveBeenCalledWith("user-1", {
            workspaceId: "ws-1",
            runId: "run-1",
            stepKey: "send-qr",
            action: "answer",
            text: "Gui lai",
        })
    })

    it("answers not_thread in an app that runs no thread, and reads nothing", async () => {
        const container = await Test.createTestingModule({ providers: [RunStopDecisionsService] }).compile()

        await expect(
            container.get(RunStopDecisionsService).decide("user-1", "ws-1", "run-1", null, "retry", undefined),
        ).resolves.toEqual({ outcome: "not_thread", stepKey: null })
    })
})
