import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { LeadMemorySnapshot } from "@nivo-lite/agent-sdk/node"
import { AgentGraphConversationReleaseService } from "@modules/domain/agent-graphs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { DecisionsError, DecisionsErrorCode } from "@modules/domain/decisions"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DoorPress } from "./agent-doors.contracts"
import { CareOptOutService } from "./care-opt-out.service"
import { DoorPressesService } from "./door-presses.service"
import { HoldReleaseDoorService, releaseHoldOf } from "./hold-release-door.service"

const SUBJECT = { key: "lead:lead-1", leadId: "lead-1", conversationId: null }

const snapshotOf = (careOptOut: boolean | undefined): LeadMemorySnapshot =>
    ({ subject: SUBJECT, lead: careOptOut === undefined ? { name: "Lan" } : { name: "Lan", careOptOut }, workflows: {} }) as LeadMemorySnapshot

const PRESS: DoorPress = {
    door: "care.opt_out",
    subject: "lead-1",
    memberId: "member-owner",
    memberName: "Owner Lan",
    outcome: "set",
    at: new Date("2026-11-11T02:00:00.000Z"),
}

const build = async (snapshots: ReadonlyArray<LeadMemorySnapshot | null>, manager?: () => Promise<string>) => {
    const access = mock<AgentWorkAccessService>({
        manager: jest.fn(manager ?? (() => Promise.resolve("member-owner"))),
    })
    const members = mock<WorkspaceMembersService>({
        require: jest.fn().mockResolvedValue({ displayName: "Owner Lan" } as WorkspaceMember),
    })
    const memory = mock<LeadMemoryService>({ remember: jest.fn().mockResolvedValue(undefined) })
    snapshots.forEach((snapshot) => memory.snapshot.mockResolvedValueOnce(snapshot))
    const presses = mock<DoorPressesService>({
        record: jest.fn().mockResolvedValue(undefined),
        latest: jest.fn().mockResolvedValue(PRESS),
    })
    const release = mock<AgentGraphConversationReleaseService>({
        release: jest.fn().mockResolvedValue({ outcome: "released", person: "Owner Lan", agentId: null }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CareOptOutService,
            HoldReleaseDoorService,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AgentWorkAccessService, useValue: access },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: LeadMemoryService, useValue: memory },
            { provide: DoorPressesService, useValue: presses },
            { provide: AgentGraphConversationReleaseService, useValue: release },
        ],
    }).compile()
    return {
        optOuts: moduleRef.get(CareOptOutService),
        door: moduleRef.get(HoldReleaseDoorService),
        memory,
        presses,
        release,
    }
}

describe("CareOptOutService (the shop's door to a customer's care opt-out)", () => {
    it("sets the one fact care already reads, in the customer's lead memory, and records who and when", async () => {
        const { optOuts, memory, presses } = await build([snapshotOf(undefined), snapshotOf(true)])

        const answer = await optOuts.set("user-1", "ws-1", "lead-1", true)

        expect(memory.remember).toHaveBeenCalledWith("ws-1", SUBJECT, { careOptOut: true })
        expect(presses.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            door: "care.opt_out",
            subject: "lead-1",
            memberId: "member-owner",
            memberName: "Owner Lan",
            outcome: "set",
            detail: { optOut: true },
        })
        expect(answer).toEqual({ outcome: "set", view: { leadId: "lead-1", optedOut: true, lastPress: PRESS } })
    })

    it("clears an opt-out the customer's words set (false is written, so care and the send guard read it as off)", async () => {
        const { optOuts, memory } = await build([snapshotOf(true), snapshotOf(false)])

        await expect(optOuts.set("user-1", "ws-1", "lead-1", false)).resolves.toMatchObject({
            outcome: "set",
            view: { optedOut: false },
        })
        expect(memory.remember).toHaveBeenCalledWith("ws-1", SUBJECT, { careOptOut: false })
    })

    it("answers unchanged when it already stood so (still recorded), and not_found for a customer the workspace does not have", async () => {
        const same = await build([snapshotOf(true), snapshotOf(true)])
        const missing = await build([null])

        await expect(same.optOuts.set("user-1", "ws-1", "lead-1", true)).resolves.toMatchObject({ outcome: "unchanged" })
        await expect(missing.optOuts.set("user-1", "ws-1", "lead-x", true)).resolves.toEqual({ outcome: "not_found", view: null })
        expect(same.presses.record).toHaveBeenCalledTimes(1)
        expect(missing.memory.remember).not.toHaveBeenCalled()
    })

    it("reads the fact and the last press, and refuses a seat that is not an owner or manager", async () => {
        const { optOuts } = await build([snapshotOf(true)])
        const denied = new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        const staff = await build([], () => Promise.reject(denied))

        await expect(optOuts.read("user-1", "ws-1", "lead-1")).resolves.toEqual({ leadId: "lead-1", optedOut: true, lastPress: PRESS })
        await expect(staff.optOuts.set("user-2", "ws-1", "lead-1", false)).rejects.toBe(denied)
        expect(staff.memory.remember).not.toHaveBeenCalled()
    })
})

describe("HoldReleaseDoorService (hand back to the agent)", () => {
    it("hands the conversation back through the engine's own release, as an owner or manager, and records who and when", async () => {
        const { door, release, presses } = await build([])

        await expect(door.hand("user-1", "ws-1", "conv-1", "both")).resolves.toMatchObject({ outcome: "released" })

        expect(release.release).toHaveBeenCalledWith("ws-1", "conv-1", "both")
        expect(presses.record).toHaveBeenCalledWith(
            expect.objectContaining({ door: "conversation.release", subject: "conv-1", memberId: "member-owner", outcome: "released" }),
        )
    })

    it("records nothing when nothing was held, and reads the hold a caller names (unknown or absent: both)", async () => {
        const { door, release, presses } = await build([])
        release.release.mockResolvedValue({ outcome: "nothing_held", person: null, agentId: null })

        await expect(door.hand("user-1", "ws-1", "conv-1", "person")).resolves.toMatchObject({ outcome: "nothing_held" })
        expect(presses.record).not.toHaveBeenCalled()
        expect([releaseHoldOf("agent"), releaseHoldOf(null), releaseHoldOf("x")]).toEqual(["agent", "both", "both"])
    })
})
