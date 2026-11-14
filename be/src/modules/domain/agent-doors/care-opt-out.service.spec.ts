import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { LeadMemorySnapshot } from "@nivo-lite/agent-sdk/node"
import { StopHandBackService } from "@modules/domain/agent-threads"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { HeldLinesService } from "@modules/domain/conversations"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { MemberLookupService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DoorPress } from "./agent-doors.contracts"
import { CareOptOutService } from "./care-opt-out.service"
import { DoorPressesService } from "./door-presses.service"
import { HoldReleaseDoorService } from "./hold-release-door.service"

const SUBJECT = { key: "lead:lead-1", contactId: null, conversationId: null }

/** The one transaction a hand-back runs in. */
const TX = { tx: "hand-back" }

const snapshotOf = (careOptOut: boolean | undefined): LeadMemorySnapshot =>
    ({
        subject: SUBJECT,
        lead: careOptOut === undefined ? { name: "Lan" } : { name: "Lan", careOptOut },
        workflows: {},
    }) as LeadMemorySnapshot

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
    const routes = mock<CustomerRoutesService>()
    routes.get.mockResolvedValue(
        mock<NonNullable<Awaited<ReturnType<CustomerRoutesService["get"]>>>>({ id: "route-1" }),
    )
    const heldLines = mock<HeldLinesService>({ answerHeld: jest.fn().mockResolvedValue(1) })
    const takeOvers = mock<StopHandBackService>({ handedBack: jest.fn().mockResolvedValue(0) })
    const seats = mock<MemberLookupService>()
    seats.activeSeatById.mockImplementation((_workspaceId, memberId) =>
        Promise.resolve(memberId === "m-staff" ? { displayName: "Staff Hoa", isManager: false } : null),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            CareOptOutService,
            HoldReleaseDoorService,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AgentWorkAccessService, useValue: access },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: LeadMemoryService, useValue: memory },
            { provide: DoorPressesService, useValue: presses },
            { provide: CustomerRoutesService, useValue: routes },
            { provide: HeldLinesService, useValue: heldLines },
            { provide: MemberLookupService, useValue: seats },
            { provide: StopHandBackService, useValue: takeOvers },
            // The hand-back runs in ONE transaction (R51 item 3): every part is handed the same `TX`.
            {
                provide: PRIMARY_ENTITY_MANAGER,
                useValue: { transaction: (work: (tx: unknown) => unknown) => work(TX) },
            },
        ],
    }).compile()
    return {
        optOuts: moduleRef.get(CareOptOutService),
        door: moduleRef.get(HoldReleaseDoorService),
        memory,
        presses,
        routes,
        heldLines,
        seats,
        takeOvers,
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

        await expect(same.optOuts.set("user-1", "ws-1", "lead-1", true)).resolves.toMatchObject({
            outcome: "unchanged",
        })
        await expect(missing.optOuts.set("user-1", "ws-1", "lead-x", true)).resolves.toEqual({
            outcome: "not_found",
            view: null,
        })
        expect(same.presses.record).toHaveBeenCalledTimes(1)
        expect(missing.memory.remember).not.toHaveBeenCalled()
    })

    it("reads the fact and the last press, and refuses a seat that is not an owner or manager", async () => {
        const { optOuts } = await build([snapshotOf(true)])
        const denied = new Error("seat refused")
        const staff = await build([], () => Promise.reject(denied))

        await expect(optOuts.read("user-1", "ws-1", "lead-1")).resolves.toEqual({
            leadId: "lead-1",
            optedOut: true,
            lastPress: PRESS,
        })
        await expect(staff.optOuts.set("user-2", "ws-1", "lead-1", false)).rejects.toBe(denied)
        expect(staff.memory.remember).not.toHaveBeenCalled()
    })
})

// Ledger (ROAD Opus-1d, 2026-11-14): ruling R35 deleted the engine's agent conversation hold; "hand back" keeps only its generic half (ONE
// resume event delivered for the route), so the cases about which hold is cleared (`person` / `agent` / `both`) are gone with it.
describe("HoldReleaseDoorService (hand back to the agent)", () => {
    it("delivers exactly one resume event for the route, as an owner or manager, and records who and when", async () => {
        const { door, heldLines, presses, routes } = await build([])
        routes.release.mockResolvedValue({ memberId: "m-staff", at: "2026-11-14T08:00:00.000Z" })

        await expect(door.hand("user-1", "ws-1", "route-1")).resolves.toEqual({ outcome: "released", answered: 1 })

        expect(heldLines.answerHeld).toHaveBeenCalledTimes(1)
        expect(heldLines.answerHeld).toHaveBeenCalledWith("ws-1", "route-1", TX)
        expect(presses.record).toHaveBeenCalledWith(
            expect.objectContaining({
                door: "conversation.release",
                subject: "route-1",
                memberId: "member-owner",
                outcome: "released",
            }),
        )
    })

    // MX-CORE DEF-4 (dev 2026-11-14, row H-03): a SECOND "hand back" with nothing held answered `released, answered 1`, delivered a second
    // resume event and the agent sent a second real message with no new line of the person. The old spec asserted that very call (a press
    // with no hold and no take-over still delivered the resume event: `answerHeld` called once), so the double-delivery was the spec's own
    // expectation. One resume event per hand-back: a press that ends nothing delivers nothing.
    it("a press with nothing held (no staff hold, no take-over) delivers NO resume event, answers nothing_held and records nothing", async () => {
        const { door, heldLines, presses, routes } = await build([])

        await expect(door.hand("user-1", "ws-1", "route-1")).resolves.toEqual({ outcome: "nothing_held", answered: 0 })
        routes.get.mockResolvedValue(null)
        await expect(door.hand("user-1", "ws-1", "route-x")).resolves.toEqual({ outcome: "not_found", answered: 0 })
        expect(heldLines.answerHeld).not.toHaveBeenCalled()
        expect(presses.record).not.toHaveBeenCalled()
    })

    it("DEF-4: the second press after a hand-back that released answers nothing_held and delivers no second resume event", async () => {
        const { door, heldLines, presses, routes } = await build([])
        // The route store as Postgres answers it: the first release clears the hold and answers who held it, the second finds none.
        routes.release.mockResolvedValueOnce({ memberId: "m-staff", at: "2026-11-14T08:00:00.000Z" }).mockResolvedValue(null)

        await expect(door.hand("user-1", "ws-1", "route-1")).resolves.toEqual({ outcome: "released", answered: 1 })
        await expect(door.hand("user-1", "ws-1", "route-1")).resolves.toEqual({ outcome: "nothing_held", answered: 0 })

        expect(heldLines.answerHeld).toHaveBeenCalledTimes(1)
        expect(presses.record).toHaveBeenCalledTimes(1)
    })

    it("refuses a seat that is not an owner or manager before it delivers anything", async () => {
        const denied = new Error("seat refused")
        const { door, heldLines, routes } = await build([], () => Promise.reject(denied))

        await expect(door.hand("user-2", "ws-1", "route-1")).rejects.toBe(denied)
        expect(heldLines.answerHeld).not.toHaveBeenCalled()
        expect(routes.release).not.toHaveBeenCalled()
    })

    it("clears the staff hold of the route BEFORE the resume event is delivered (ruling R43), and records who held it", async () => {
        const { door, heldLines, presses, routes } = await build([])
        const order: Array<string> = []
        routes.release.mockImplementation(() => {
            order.push("release")
            return Promise.resolve({ memberId: "m-staff", at: "2026-11-14T08:00:00.000Z" })
        })
        heldLines.answerHeld.mockImplementation(() => {
            order.push("resume")
            return Promise.resolve(1)
        })

        await expect(door.hand("user-1", "ws-1", "route-1")).resolves.toEqual({ outcome: "released", answered: 1 })

        expect(order).toEqual(["release", "resume"])
        expect(routes.release).toHaveBeenCalledWith("ws-1", "route-1", TX)
        expect(presses.record).toHaveBeenCalledWith(
            expect.objectContaining({ detail: { answered: 1, heldBy: "m-staff", takeOversEnded: 0 } }),
        )
    })

    // Ruling R51 item 3 (dev 2026-11-14: the hold cleared, but the stop a person took over stayed open, its freeze held the resume event and
    // the card kept "Hand back"): the hand-back ENDS every take-over on the route as the person, in the same transaction, between the hold
    // and the resume event.
    it("ends the stops a person took over on the route as the person, in the same transaction, after the hold and before the resume event", async () => {
        const { door, heldLines, presses, routes, takeOvers } = await build([])
        routes.get.mockResolvedValue(
            mock<NonNullable<Awaited<ReturnType<CustomerRoutesService["get"]>>>>({
                id: "route-1",
                contactId: "contact-1",
            }),
        )
        const order: Array<string> = []
        routes.release.mockImplementation(() => {
            order.push("release")
            return Promise.resolve({ memberId: "member-owner", at: "2026-11-14T08:00:00.000Z" })
        })
        takeOvers.handedBack.mockImplementation(() => {
            order.push("take-overs")
            return Promise.resolve(1)
        })
        heldLines.answerHeld.mockImplementation(() => {
            order.push("resume")
            return Promise.resolve(1)
        })

        await expect(door.hand("user-1", "ws-1", "route-1")).resolves.toEqual({ outcome: "released", answered: 1 })

        expect(order).toEqual(["release", "take-overs", "resume"])
        expect(takeOvers.handedBack).toHaveBeenCalledWith(TX, "ws-1", "route-1", "contact-1", "member-owner")
        expect(presses.record).toHaveBeenCalledWith(
            expect.objectContaining({ detail: { answered: 1, heldBy: "member-owner", takeOversEnded: 1 } }),
        )
    })

    it("answers released when only a take-over was ended (no hold left, nothing woken yet), never nothing_held", async () => {
        const { door, heldLines, takeOvers } = await build([])
        takeOvers.handedBack.mockResolvedValue(1)
        heldLines.answerHeld.mockResolvedValue(0)

        await expect(door.hand("user-1", "ws-1", "route-1")).resolves.toEqual({ outcome: "released", answered: 0 })
    })

    it("answers released when a hold was cleared although no graph took the resume event", async () => {
        const { door, heldLines, presses, routes } = await build([])
        routes.release.mockResolvedValue({ memberId: "m-staff", at: "2026-11-14T08:00:00.000Z" })
        heldLines.answerHeld.mockResolvedValue(0)

        await expect(door.hand("user-1", "ws-1", "route-1")).resolves.toEqual({ outcome: "released", answered: 0 })
        expect(presses.record).toHaveBeenCalledTimes(1)
    })
})

// The `platform.route-holds` port's hand-back (ruling R43): the same act as the GraphQL door, as the seat a workbench action runs as.
describe("HoldReleaseDoorService.handAs (the hand-back of a workbench action, as its seat)", () => {
    it("clears the hold, THEN delivers the one resume event, and records the acting seat by its name", async () => {
        const { door, heldLines, presses, routes } = await build([])
        const order: Array<string> = []
        routes.release.mockImplementation(() => {
            order.push("release")
            return Promise.resolve({ memberId: "m-staff", at: "2026-11-14T08:00:00.000Z" })
        })
        heldLines.answerHeld.mockImplementation(() => {
            order.push("resume")
            return Promise.resolve(1)
        })

        await expect(door.handAs("ws-1", "m-staff", "route-1")).resolves.toEqual({ outcome: "released", answered: 1 })

        expect(order).toEqual(["release", "resume"])
        expect(presses.record).toHaveBeenCalledWith(
            expect.objectContaining({
                door: "conversation.release",
                subject: "route-1",
                memberId: "m-staff",
                memberName: "Staff Hoa",
            }),
        )
    })

    it("refuses a member with no active seat with a typed error before it touches the route", async () => {
        const { door, heldLines, routes } = await build([])

        await expect(door.handAs("ws-1", "m-gone", "route-1")).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_MEMBER_NOT_FOUND",
            params: { memberId: "m-gone" },
        })
        expect(routes.release).not.toHaveBeenCalled()
        expect(heldLines.answerHeld).not.toHaveBeenCalled()
    })

    it("answers not_found for a route the workspace does not hold, and nothing_held (no event delivered) when there was nothing to give back", async () => {
        const { door, heldLines, presses, routes } = await build([])

        await expect(door.handAs("ws-1", "m-staff", "route-1")).resolves.toEqual({
            outcome: "nothing_held",
            answered: 0,
        })
        routes.get.mockResolvedValue(null)
        await expect(door.handAs("ws-1", "m-staff", "route-x")).resolves.toEqual({ outcome: "not_found", answered: 0 })
        expect(heldLines.answerHeld).not.toHaveBeenCalled()
        expect(presses.record).not.toHaveBeenCalled()
    })
})
