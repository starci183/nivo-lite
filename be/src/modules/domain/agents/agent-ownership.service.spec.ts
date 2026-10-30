import { Test } from "@nestjs/testing"
import {
    accountingTarget,
    agentMemberOf as memberOf,
    agentOfOtherWorkspace,
    openAgentOf,
    ownedAgentOf,
    ownerlessAgent,
    roomlessOpenAgent,
    taggedAgent,
    taggingAgent,
    untaggedAgent,
} from "@tests/fixtures/builders/agents.builder"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import {
    WorkspaceMemberDirectoryService,
    WorkspaceMemberSeatsService,
    WorkspaceMembersService,
} from "@modules/domain/workspace-members"
import type { MemberSeatRecord } from "@modules/domain/workspace-members"
import { OfficeRoomDirectoryService } from "@modules/domain/office-rooms"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentOwnershipService } from "./agent-ownership.service"
import { AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

/** The statement `callDbFunction` sends for the workspace owner. */
const FIND_WORKSPACE_OWNER = "SELECT * FROM public.workspace_owner_member($1)"
const ownerRow = (id: string | null) => [{ workspace_owner_member: id }]

const seatOf = builder<MemberSeatRecord>({
    memberId: "m-minh",
    userId: "u-minh",
    role: "manager",
    displayName: "Minh",
    status: "active",
})

/** What the member reads answer for one manager: the active ids, the seats, the account's seat id and the active count. */
interface SeatWorld {
    readonly active?: ReadonlyArray<string>
    readonly seatById?: MemberSeatRecord | null
    readonly seatsByIds?: ReadonlyArray<MemberSeatRecord>
    readonly idOfUser?: string | null
    readonly counted?: number
}

/** Who sits in the department rooms of the workspace. */
interface SeatRoom {
    readonly userId: string
    readonly key: string
}

const build = async (
    entityManager: MockEntityManager,
    world: SeatWorld = {},
    seatRooms: ReadonlyArray<SeatRoom> = [{ userId: "u-lan", key: "sales" }],
) => {
    const rooms = mock<OfficeRoomDirectoryService>({
        labelsOf: jest.fn(() => Promise.resolve([{ key: "sales", name: "Sales" }])),
        seatRoomsOf: jest.fn(() => Promise.resolve([...seatRooms])),
    })
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(memberOf())) })
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeIdsAmong.mockResolvedValue([...(world.active ?? [])])
    seats.seatById.mockResolvedValue(world.seatById ?? null)
    seats.seatsByIds.mockResolvedValue([...(world.seatsByIds ?? [])])
    seats.countActiveAmong.mockResolvedValue(world.counted ?? 0)
    const directory = mock<WorkspaceMemberDirectoryService>()
    directory.idOfUser.mockResolvedValue(world.idOfUser ?? null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentOwnershipService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OfficeRoomDirectoryService, useValue: rooms },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: WorkspaceMemberDirectoryService, useValue: directory },
        ],
    }).compile()
    return { service: moduleRef.get(AgentOwnershipService), members, seats, directory, rooms }
}

const OWNERSHIP = ownedAgentOf()

describe("AgentOwnershipService ownerOf", () => {
    it("answers the owner and the fallback while both are active", async () => {
        const em = mockEntityManager({
            findOne: [AgentEntity, OWNERSHIP],
            query: [FIND_WORKSPACE_OWNER, ownerRow("m-nam")],
        })
        const { service, seats } = await build(em, { active: ["m-minh", "m-nam"] })

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-minh", fallbackMemberId: "m-nam" })
        expect(em.findOne).toHaveBeenCalledWith(AgentEntity, { where: { id: "a1" } })
        expect(seats.activeIdsAmong).toHaveBeenCalledWith("w1", ["m-minh", "m-nam"], 10)
        expect(em.query).toHaveBeenCalledWith(FIND_WORKSPACE_OWNER, ["w1"])
    })

    it("falls back when the owner left the workspace", async () => {
        const em = mockEntityManager({
            findOne: [AgentEntity, OWNERSHIP],
            query: [FIND_WORKSPACE_OWNER, ownerRow("m-nam")],
        })
        const { service } = await build(em, { active: ["m-nam"] })

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-nam", fallbackMemberId: null })
    })

    it("falls back to the workspace owner when the owner and the fallback are both gone", async () => {
        const em = mockEntityManager({
            findOne: [AgentEntity, OWNERSHIP],
            query: [FIND_WORKSPACE_OWNER, ownerRow("m-ceo")],
        })
        const { service } = await build(em, { active: [] })

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-ceo", fallbackMemberId: null })
    })

    it("asks the active list only about the members the agent names", async () => {
        const legacy = ownerlessAgent()
        const em = mockEntityManager({
            findOne: [AgentEntity, legacy],
            query: [FIND_WORKSPACE_OWNER, ownerRow("m-ceo")],
        })
        const { service, seats } = await build(em)

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-ceo", fallbackMemberId: null })
        expect(seats.activeIdsAmong).toHaveBeenCalledWith("w1", [], 10)
    })

    it("refuses when nobody in the chain is active", async () => {
        const em = mockEntityManager({ findOne: [AgentEntity, OWNERSHIP], query: [FIND_WORKSPACE_OWNER, []] })
        const { service } = await build(em)

        await expect(service.ownerOf("a1")).rejects.toMatchObject({ code: AgentsErrorCode.OwnerUnavailable })
    })

    it("refuses an agent that does not exist", async () => {
        const { service } = await build(mockEntityManager({ findOne: [AgentEntity, null] }))

        await expect(service.ownerOf("ghost")).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
            params: { id: "ghost" },
        })
    })
})

describe("AgentOwnershipService canTag", () => {
    const from = taggingAgent()
    const to = taggedAgent()

    it("admits a listed agent", async () => {
        const em = mockEntityManager({ find: [AgentEntity, [from, to]] })
        const { service } = await build(em)

        await expect(service.canTag("a1", "a2")).resolves.toBe(true)
        expect(em.find).toHaveBeenCalledWith(AgentEntity, {
            where: { id: In(["a1", "a2"]) },
            take: 2,
        })
    })

    it("refuses an agent that is not on the list", async () => {
        const em = mockEntityManager({ find: [AgentEntity, [from, untaggedAgent()]] })
        const { service } = await build(em)

        await expect(service.canTag("a1", "a3")).resolves.toBe(false)
    })

    it("refuses an agent that does not exist", async () => {
        const { service } = await build(mockEntityManager({ find: [AgentEntity, [from]] }))

        await expect(service.canTag("a1", "ghost")).resolves.toBe(false)
    })
})

const OPEN_AGENT = openAgentOf()
const LAN = seatOf({ memberId: "m-lan", userId: "u-lan", role: "staff" })

describe("AgentOwnershipService canAssign", () => {
    it("admits a staff member who sits in an open room", async () => {
        const em = mockEntityManager({ findOne: [AgentEntity, OPEN_AGENT] })
        const { service, seats } = await build(em, { seatById: LAN })

        await expect(service.canAssign("m-lan", "a1")).resolves.toBe(true)
        expect(em.findOne).toHaveBeenCalledWith(AgentEntity, { where: { id: "a1" } })
        expect(seats.seatById).toHaveBeenCalledWith("w1", "m-lan")
    })

    it("refuses once the room was revoked from the agent", async () => {
        const em = mockEntityManager({ findOne: [AgentEntity, roomlessOpenAgent()] })
        const { service } = await build(em, { seatById: LAN })

        await expect(service.canAssign("m-lan", "a1")).resolves.toBe(false)
    })

    it("refuses a member or agent that does not exist", async () => {
        const absentMember = mockEntityManager({ findOne: [AgentEntity, OPEN_AGENT] })
        await expect((await build(absentMember, { seatById: null })).service.canAssign("ghost", "a1")).resolves.toBe(
            false,
        )
        const { service } = await build(mockEntityManager({ findOne: [AgentEntity, null] }))

        await expect(service.canAssign("m-lan", "ghost")).resolves.toBe(false)
    })
})

describe("AgentOwnershipService memberIdOf", () => {
    it("answers the member row of the signed-in account", async () => {
        const { service, members, directory } = await build(mockEntityManager(), { idOfUser: "m-minh" })

        await expect(service.memberIdOf("u1", "w1")).resolves.toBe("m-minh")
        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(directory.idOfUser).toHaveBeenCalledWith("w1", "u1")
    })

    it("refuses an account whose row cannot be read back", async () => {
        const { service } = await build(mockEntityManager(), { idOfUser: null })

        await expect(service.memberIdOf("u1", "w1")).rejects.toMatchObject({
            code: AgentsErrorCode.OwnershipInvalid,
            params: { field: "member" },
        })
    })
})

const MINH = seatOf({ memberId: "m-minh", userId: "u-minh", displayName: "Minh", role: "manager" })
const NAM = seatOf({ memberId: "m-nam", userId: "u-nam", displayName: "Nam", role: "owner" })
const TARGET = accountingTarget()

/** The world one ownership read sees: the agent, its seats, the workspace owner, its tag targets, then the room lookups in call order. */
const ownershipWorld = (
    seats: ReadonlyArray<MemberSeatRecord>,
    owner: string | null,
    agent: AgentEntity = OWNERSHIP,
) => {
    const em = mockEntityManager({
        findOne: [AgentEntity, agent],
        find: [AgentEntity, [TARGET]],
        query: [FIND_WORKSPACE_OWNER, ownerRow(owner)],
    })
    const world: SeatWorld = {
        seatsByIds: seats,
        active: seats.filter((seat) => seat.status === "active").map((seat) => seat.memberId),
    }
    return { em, world, seatRooms: [{ userId: "u-minh", key: "sales" }] }
}

describe("AgentOwnershipService ownershipOf", () => {
    it("shows the owner, the fallback, who may give the agent work and whom it may tag", async () => {
        const { em, world, seatRooms } = ownershipWorld([MINH, NAM], "m-nam")
        const { service, members, rooms } = await build(em, world, seatRooms)

        await expect(service.ownershipOf("u1", "w1", "a1")).resolves.toEqual({
            agentId: "a1",
            owner: { memberId: "m-minh", name: "Minh", role: "manager", roomId: "sales", active: true },
            fallback: { memberId: "m-nam", name: "Nam", role: "owner", roomId: null, active: true },
            responder: { ownerMemberId: "m-minh", fallbackMemberId: "m-nam" },
            assignableRoles: ["owner", "manager"],
            assignableRooms: [{ key: "sales", name: "Sales" }],
            canTag: [{ id: "a2", name: "Accounting AI", module: "accounting", status: "active" }],
        })
        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(rooms.labelsOf).toHaveBeenCalledWith("w1", ["sales"], 10)
        expect(rooms.seatRoomsOf).toHaveBeenCalledWith("w1", ["u-minh", "u-nam"], 50)
        expect(em.find).toHaveBeenCalledWith(AgentEntity, expect.objectContaining({ take: 50 }))
    })

    it("shows a disabled owner as inactive and answers through the fallback", async () => {
        const { em, world, seatRooms } = ownershipWorld([{ ...MINH, status: "disabled" }, NAM], "m-nam")
        const { service } = await build(em, world, seatRooms)

        await expect(service.ownershipOf("u1", "w1", "a1")).resolves.toMatchObject({
            owner: { memberId: "m-minh", active: false },
            responder: { ownerMemberId: "m-nam", fallbackMemberId: null },
        })
    })

    it("shows no card for a member who left", async () => {
        const { em, world, seatRooms } = ownershipWorld([NAM], "m-nam")
        const { service } = await build(em, world, seatRooms)

        await expect(service.ownershipOf("u1", "w1", "a1")).resolves.toMatchObject({
            owner: null,
            fallback: { memberId: "m-nam" },
            responder: { ownerMemberId: "m-nam" },
        })
    })

    it("refuses when the whole chain is gone", async () => {
        const { em, world, seatRooms } = ownershipWorld([], null)
        const { service } = await build(em, world, seatRooms)

        await expect(service.ownershipOf("u1", "w1", "a1")).rejects.toMatchObject({
            code: AgentsErrorCode.OwnerUnavailable,
        })
    })

    it("refuses an agent of another workspace", async () => {
        const other = agentOfOtherWorkspace()
        const { service } = await build(mockEntityManager({ findOne: [AgentEntity, other] }))

        await expect(service.ownershipOf("u1", "w1", "a1")).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
        })
    })

    it("refuses an agent that does not exist", async () => {
        const { service } = await build(mockEntityManager({ findOne: [AgentEntity, null] }))

        await expect(service.ownershipOf("u1", "w1", "ghost")).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
        })
    })
})

const CHANGE = {
    ownerMemberId: "m-minh",
    fallbackMemberId: "m-nam",
    assignableRoles: ["manager", "manager"],
    assignableRooms: ["sales", "sales"],
    canTagAgentIds: ["a2", "a2"],
}
/** A manager world: both owners are active members, the tag target exists, and the update lands on one row. */
interface WritableCounts {
    readonly members?: number
    readonly agents?: number
    readonly affected?: number
}

/** The active members the member read counts in that scenario. */
const countedOf = (counts: WritableCounts = {}): SeatWorld => ({ counted: counts.members ?? 2 })

describe("AgentOwnershipService setOwnership", () => {
    it("replaces the ownership of an agent with each id once; a manager only", async () => {
        const em = mockEntityManager({ count: [AgentEntity, 1], update: [AgentEntity, { affected: 1 }] })
        const { service, members, seats } = await build(em, countedOf())

        await service.setOwnership("u1", "w1", "a1", CHANGE)

        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
        expect(seats.countActiveAmong).toHaveBeenCalledWith("w1", ["m-minh", "m-nam"])
        expect(em.count).toHaveBeenCalledWith(AgentEntity, {
            where: { workspaceId: "w1", id: In(["a2"]) },
        })
        expect(em.update).toHaveBeenCalledWith(
            AgentEntity,
            { id: "a1", workspaceId: "w1" },
            {
                ownerMemberId: "m-minh",
                fallbackMemberId: "m-nam",
                assignableRoles: ["manager"],
                assignableRooms: ["sales"],
                canTagAgentIds: ["a2"],
            },
        )
    })

    it("accepts an owner who is also the fallback and an empty tag list without counting agents", async () => {
        const em = mockEntityManager({ count: [AgentEntity, 1], update: [AgentEntity, { affected: 1 }] })
        const { service, seats } = await build(em, countedOf({ members: 1 }))

        await service.setOwnership("u1", "w1", "a1", { ...CHANGE, fallbackMemberId: "m-minh", canTagAgentIds: [] })

        expect(seats.countActiveAmong).toHaveBeenCalledWith("w1", ["m-minh"])
        expect(em.count).not.toHaveBeenCalledWith(AgentEntity, expect.anything())
    })

    it("refuses an owner who is not an active member of the workspace", async () => {
        const { service } = await build(
            mockEntityManager({ count: [AgentEntity, 1], update: [AgentEntity, { affected: 1 }] }),
            countedOf({ members: 1 }),
        )

        await expect(service.setOwnership("u1", "w1", "a1", CHANGE)).rejects.toMatchObject({
            code: AgentsErrorCode.OwnershipInvalid,
            params: { field: "owner" },
        })
    })

    it("refuses a count the database cannot answer", async () => {
        const { service } = await build(
            mockEntityManager({ count: [AgentEntity, 1], update: [AgentEntity, { affected: 1 }] }),
            countedOf({ members: 0 }),
        )

        await expect(service.setOwnership("u1", "w1", "a1", CHANGE)).rejects.toMatchObject({
            params: { field: "owner" },
        })
    })
})

describe("AgentOwnershipService setOwnership refusals", () => {
    it("refuses a role that does not exist", async () => {
        const { service } = await build(
            mockEntityManager({ count: [AgentEntity, 1], update: [AgentEntity, { affected: 1 }] }),
            countedOf(),
        )

        await expect(
            service.setOwnership("u1", "w1", "a1", { ...CHANGE, assignableRoles: ["boss"] }),
        ).rejects.toMatchObject({ params: { field: "assignableRoles" } })
    })

    it("refuses a room that does not exist", async () => {
        const { service } = await build(
            mockEntityManager({ count: [AgentEntity, 1], update: [AgentEntity, { affected: 1 }] }),
            countedOf(),
        )

        await expect(
            service.setOwnership("u1", "w1", "a1", { ...CHANGE, assignableRooms: ["garage"] }),
        ).rejects.toMatchObject({ params: { field: "assignableRooms" } })
    })

    it("refuses an agent that tags itself", async () => {
        const { service } = await build(
            mockEntityManager({ count: [AgentEntity, 1], update: [AgentEntity, { affected: 1 }] }),
            countedOf(),
        )

        await expect(
            service.setOwnership("u1", "w1", "a1", { ...CHANGE, canTagAgentIds: ["a1"] }),
        ).rejects.toMatchObject({ params: { field: "canTagAgentIds" } })
    })

    it("refuses a tag target of another workspace", async () => {
        const { service } = await build(
            mockEntityManager({ count: [AgentEntity, 0], update: [AgentEntity, { affected: 1 }] }),
            countedOf(),
        )

        await expect(service.setOwnership("u1", "w1", "a1", CHANGE)).rejects.toMatchObject({
            params: { field: "canTagAgentIds" },
        })
    })

    it("refuses an agent that is not in the workspace", async () => {
        const { service } = await build(
            mockEntityManager({ count: [AgentEntity, 1], update: [AgentEntity, { affected: 0 }] }),
            countedOf(),
        )

        await expect(service.setOwnership("u1", "w1", "ghost", CHANGE)).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
        })
    })

    it("refuses an agent when the update does not report affected rows", async () => {
        const { service } = await build(mockEntityManager({ count: [AgentEntity, 1], update: [AgentEntity, {}] }), countedOf())

        await expect(service.setOwnership("u1", "w1", "ghost", CHANGE)).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
        })
    })
})
