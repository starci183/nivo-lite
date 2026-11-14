import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { frozenFreezeOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { stateOf } from "./lead-freeze.policy"
import { LeadFreezeDoorService } from "./lead-freeze-door.service"
import { LeadFreezesService } from "./lead-freezes.service"

const ON_STOP = stateOf(frozenFreezeOf({ frozenReason: "run_stop", workItemId: null, frozenRunId: "run-7" }))

const build = async () => {
    const access = mock<AgentWorkAccessService>({ manager: jest.fn().mockResolvedValue("member-1") })
    const freezes = mock<LeadFreezesService>({
        stateOfContact: jest.fn().mockResolvedValue(ON_STOP),
        stateOfRun: jest.fn().mockResolvedValue(ON_STOP),
        stateOf: jest.fn().mockResolvedValue(ON_STOP),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezeDoorService,
            { provide: AgentWorkAccessService, useValue: access },
            { provide: LeadFreezesService, useValue: freezes },
        ],
    }).compile()
    return { door: moduleRef.get(LeadFreezeDoorService), access, freezes }
}

const answerOf = (action: string) => ({ workspaceId: "ws-1", freezeId: "freeze-1", action, locale: "vi" as const })

describe("LeadFreezeDoorService.readFor", () => {
    it("answers the hold with the lead the page asked by, or null for the lead when it named none, and null when nothing holds", async () => {
        const { door, freezes } = await build()

        await expect(door.readFor("user-1", { workspaceId: "ws-1", runId: "run-7", leadId: "lead-1" })).resolves.toMatchObject({
            id: "freeze-1",
            leadId: "lead-1",
        })
        await expect(door.readFor("user-1", { workspaceId: "ws-1", runId: "run-7" })).resolves.toMatchObject({ leadId: null })
        freezes.stateOfRun.mockResolvedValue(null)
        await expect(door.readFor("user-1", { workspaceId: "ws-1", runId: "run-7", leadId: "lead-1" })).resolves.toBeNull()
    })
})

describe("LeadFreezeDoorService.read", () => {
    it("answers the hold of a lead or of a run's customer for an owner or manager, and nothing when neither is named", async () => {
        const { door, access, freezes } = await build()

        await expect(door.read("user-1", { workspaceId: "ws-1", contactId: "lead-1" })).resolves.toMatchObject({
            id: "freeze-1",
            onStop: true,
        })
        await expect(door.read("user-1", { workspaceId: "ws-1", runId: "run-7" })).resolves.toMatchObject({
            runId: "run-7",
        })
        await expect(door.read("user-1", { workspaceId: "ws-1" })).resolves.toBeNull()

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(freezes.stateOfContact).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(freezes.stateOfRun).toHaveBeenCalledWith("ws-1", "run-7")
    })
})

describe("LeadFreezeDoorService.answer", () => {
    it("sends the founder to the stop for a customer held by a thread run's stop: no retry, skip or take-over of the hold", async () => {
        const { door, access } = await build()

        await expect(door.answer("user-1", answerOf("retry"))).resolves.toEqual({ outcome: "on_stop" })
        await expect(door.answer("user-1", answerOf("skip"))).resolves.toEqual({ outcome: "on_stop" })
        await expect(door.answer("user-1", answerOf("take_over"))).resolves.toEqual({ outcome: "on_stop" })

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
    })

    it("answers not_found for a freeze that holds nobody, or one that is no stop's hold", async () => {
        const { door, freezes } = await build()

        freezes.stateOf.mockResolvedValueOnce(null)
        await expect(door.answer("user-1", answerOf("retry"))).resolves.toEqual({ outcome: "not_found" })
        freezes.stateOf.mockResolvedValueOnce(stateOf(frozenFreezeOf()))
        await expect(door.answer("user-1", answerOf("skip"))).resolves.toEqual({ outcome: "not_found" })
    })

    it("refuses a person who may not decide for the workspace", async () => {
        const { door, access, freezes } = await build()
        access.manager.mockRejectedValueOnce(new Error("WORKSPACE_FORBIDDEN"))

        await expect(door.answer("user-2", answerOf("retry"))).rejects.toThrow("WORKSPACE_FORBIDDEN")
        expect(freezes.stateOf).not.toHaveBeenCalled()
    })
})
