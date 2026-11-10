import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { WorkDecisionService } from "@modules/domain/decisions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { frozenFreezeOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { stateOf } from "./lead-freeze.policy"
import { LeadFreezeDoorService } from "./lead-freeze-door.service"
import { LeadFreezesService } from "./lead-freezes.service"

const STATE = stateOf(frozenFreezeOf())

const build = async () => {
    const access = mock<AgentWorkAccessService>({ manager: jest.fn().mockResolvedValue("member-1") })
    const members = mock<WorkspaceMembersService>({
        require: jest.fn().mockResolvedValue({ displayName: "Lan", role: "owner" }),
    })
    const freezes = mock<LeadFreezesService>({
        stateOfLead: jest.fn().mockResolvedValue(STATE),
        stateOfRun: jest.fn().mockResolvedValue(STATE),
        stateOf: jest.fn().mockResolvedValue(STATE),
        takeOver: jest.fn().mockResolvedValue("taken_over"),
    })
    const work = mock<WorkDecisionService>({ decide: jest.fn().mockResolvedValue({}) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezeDoorService,
            { provide: AgentWorkAccessService, useValue: access },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: LeadFreezesService, useValue: freezes },
            { provide: WorkDecisionService, useValue: work },
        ],
    }).compile()
    return { door: moduleRef.get(LeadFreezeDoorService), access, freezes, work }
}

const answerOf = (action: string) => ({ workspaceId: "ws-1", freezeId: "freeze-1", action, locale: "vi" as const })

describe("LeadFreezeDoorService.read", () => {
    it("answers the freeze of a lead or of a run's customer for an owner or manager, and nothing when neither is named", async () => {
        const { door, access, freezes } = await build()

        await expect(door.read("user-1", { workspaceId: "ws-1", leadId: "lead-1" })).resolves.toMatchObject({
            id: "freeze-1",
        })
        await expect(door.read("user-1", { workspaceId: "ws-1", runId: "run-1" })).resolves.toMatchObject({
            runId: "run-1",
        })
        await expect(door.read("user-1", { workspaceId: "ws-1" })).resolves.toBeNull()

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(freezes.stateOfLead).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(freezes.stateOfRun).toHaveBeenCalledWith("ws-1", "run-1")
    })
})

describe("LeadFreezeDoorService.answer", () => {
    it("retries and skips through the freeze's own work item, as the inbox decides it", async () => {
        const { door, work, freezes } = await build()
        freezes.stateOf.mockResolvedValueOnce(STATE).mockResolvedValueOnce(null)

        await expect(door.answer("user-1", answerOf("retry"))).resolves.toEqual({ outcome: "released" })
        expect(work.decide).toHaveBeenCalledWith("user-1", "ws-1", {
            workItemId: "item-1",
            decision: "approved",
            locale: "vi",
        })

        freezes.stateOf.mockResolvedValueOnce(STATE).mockResolvedValueOnce(STATE)
        await expect(door.answer("user-1", answerOf("skip"))).resolves.toHaveProperty("outcome", "still_frozen")
        expect(work.decide).toHaveBeenLastCalledWith("user-1", "ws-1", {
            workItemId: "item-1",
            decision: "rejected",
            locale: "vi",
        })

        freezes.stateOf.mockResolvedValueOnce(STATE).mockResolvedValueOnce(null)
        await expect(door.answer("user-1", answerOf("skip"))).resolves.toHaveProperty("outcome", "skipped")
        freezes.stateOf
            .mockResolvedValueOnce(STATE)
            .mockResolvedValueOnce(STATE === null ? null : { ...STATE, status: "retrying" })
        await expect(door.answer("user-1", answerOf("retry"))).resolves.toHaveProperty("outcome", "retrying")
    })

    it("hands the conversation to the caller by name, and refuses a freeze that is gone, an item-less freeze or an unknown answer", async () => {
        const { door, freezes, work } = await build()

        await expect(door.answer("user-1", answerOf("take_over"))).resolves.toHaveProperty("outcome", "taken_over")
        expect(freezes.takeOver).toHaveBeenCalledWith("ws-1", "freeze-1", "Lan")

        freezes.stateOf.mockResolvedValueOnce(null)
        await expect(door.answer("user-1", answerOf("retry"))).resolves.toHaveProperty("outcome", "not_frozen")
        freezes.stateOf.mockResolvedValueOnce(STATE === null ? null : { ...STATE, workItemId: null })
        await expect(door.answer("user-1", answerOf("skip"))).resolves.toHaveProperty("outcome", "not_frozen")
        await expect(door.answer("user-1", answerOf("delete"))).resolves.toHaveProperty("outcome", "not_frozen")
        expect(work.decide).not.toHaveBeenCalled()
    })
})
