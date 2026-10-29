import { Test } from "@nestjs/testing"
import { agentEntityOf, agentMemberOf as memberOf } from "@tests/fixtures/builders/agents.builder"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMemberEntity, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { OfficeRoomDirectoryService } from "@modules/domain/office-rooms"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentOwnershipService } from "./agent-ownership.service"
import { AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

/** The statement `callDbFunction` sends for the workspace owner. */
const FIND_WORKSPACE_OWNER = "SELECT * FROM public.workspace_owner_member($1)"
const ownerRow = (id: string | null) => [{ workspace_owner_member: id }]

const seatOf = builder<WorkspaceMemberEntity>({
    id: "m-minh",
    workspaceId: "w1",
    userId: "u-minh",
    role: "manager",
    staffId: null,
    displayName: "Minh",
    status: "active",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})

/** The department rooms of the workspace: who sits in them and what they are called. */
const roomsOf = (seatRooms: ReadonlyArray<{ userId: string; key: string }> = [{ userId: "u-lan", key: "sales" }]) =>
    mock<OfficeRoomDirectoryService>({
        labelsOf: jest.fn(() => Promise.resolve([{ key: "sales", name: "Sales" }])),
        seatRoomsOf: jest.fn(() => Promise.resolve([...seatRooms])),
    })

const build = async (entityManager: MockEntityManager, rooms: OfficeRoomDirectoryService = roomsOf()) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(memberOf())) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentOwnershipService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OfficeRoomDirectoryService, useValue: rooms },
        ],
    }).compile()
    return { service: moduleRef.get(AgentOwnershipService), members }
}

const OWNERSHIP = agentEntityOf({
    id: "a1",
    workspaceId: "w1",
    name: "AI Sales",
    ownerMemberId: "m-minh",
    fallbackMemberId: "m-nam",
    assignableRoles: ["owner", "manager"],
    assignableRooms: ["sales"],
    canTagAgentIds: ["a2"],
})

describe("AgentOwnershipService ownerOf", () => {
    it("answers the owner and the fallback while both are active", async () => {
        const em = mockEntityManager({
            findOne: [AgentEntity, OWNERSHIP],
            find: [WorkspaceMemberEntity, [seatOf({ id: "m-minh" }), seatOf({ id: "m-nam" })]],
            query: [FIND_WORKSPACE_OWNER, ownerRow("m-nam")],
        })
        const { service } = await build(em)

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-minh", fallbackMemberId: "m-nam" })
        expect(em.findOne).toHaveBeenCalledWith(AgentEntity, { where: { id: "a1" } })
        expect(em.find).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            select: { id: true },
            where: {
                workspaceId: "w1",
                id: expect.objectContaining({ _value: ["m-minh", "m-nam"] }),
                status: "active",
            },
            take: 10,
        })
        expect(em.query).toHaveBeenCalledWith(FIND_WORKSPACE_OWNER, ["w1"])
    })

    it("falls back when the owner left the workspace", async () => {
        const em = mockEntityManager({
            findOne: [AgentEntity, OWNERSHIP],
            find: [WorkspaceMemberEntity, [seatOf({ id: "m-nam" })]],
            query: [FIND_WORKSPACE_OWNER, ownerRow("m-nam")],
        })
        const { service } = await build(em)

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-nam", fallbackMemberId: null })
    })

    it("falls back to the workspace owner when the owner and the fallback are both gone", async () => {
        const em = mockEntityManager({
            findOne: [AgentEntity, OWNERSHIP],
            find: [WorkspaceMemberEntity, []],
            query: [FIND_WORKSPACE_OWNER, ownerRow("m-ceo")],
        })
        const { service } = await build(em)

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-ceo", fallbackMemberId: null })
    })

    it("asks the active list only about the members the agent names", async () => {
        const legacy = { ...OWNERSHIP, ownerMemberId: null, fallbackMemberId: null }
        const em = mockEntityManager({
            findOne: [AgentEntity, legacy],
            find: [WorkspaceMemberEntity, []],
            query: [FIND_WORKSPACE_OWNER, ownerRow("m-ceo")],
        })
        const { service } = await build(em)

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-ceo", fallbackMemberId: null })
        expect(em.find).toHaveBeenCalledWith(
            WorkspaceMemberEntity,
            expect.objectContaining({ where: expect.objectContaining({ workspaceId: "w1" }) }),
        )
    })

    it("refuses when nobody in the chain is active", async () => {
        const em = mockEntityManager({
            findOne: [AgentEntity, OWNERSHIP],
            find: [WorkspaceMemberEntity, []],
            query: [FIND_WORKSPACE_OWNER, []],
        })
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
    const from = agentEntityOf({ id: "a1", canTagAgentIds: ["a2"] })
    const to = agentEntityOf({ id: "a2", name: "Accounting AI" })

    it("admits a listed agent", async () => {
        const em = mockEntityManager({ find: [AgentEntity, [from, to]] })
        const { service } = await build(em)

        await expect(service.canTag("a1", "a2")).resolves.toBe(true)
        expect(em.find).toHaveBeenCalledWith(AgentEntity, {
            where: { id: expect.objectContaining({ _value: ["a1", "a2"] }) },
            take: 2,
        })
    })

    it("refuses an agent that is not on the list", async () => {
        const em = mockEntityManager({ find: [AgentEntity, [from, agentEntityOf({ id: "a3" })]] })
        const { service } = await build(em)

        await expect(service.canTag("a1", "a3")).resolves.toBe(false)
    })

    it("refuses an agent that does not exist", async () => {
        const { service } = await build(mockEntityManager({ find: [AgentEntity, [from]] }))

        await expect(service.canTag("a1", "ghost")).resolves.toBe(false)
    })
})

const OPEN_AGENT = agentEntityOf({
    id: "a1",
    workspaceId: "w1",
    assignableRoles: ["owner", "manager"],
    assignableRooms: ["sales"],
})
const LAN = seatOf({ id: "m-lan", userId: "u-lan", role: "staff" })

describe("AgentOwnershipService canAssign", () => {
    it("admits a staff member who sits in an open room", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentEntity, OPEN_AGENT],
                [WorkspaceMemberEntity, LAN],
            ],
        })
        const { service } = await build(em)

        await expect(service.canAssign("m-lan", "a1")).resolves.toBe(true)
        expect(em.findOne).toHaveBeenCalledWith(AgentEntity, { where: { id: "a1" } })
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, { where: { id: "m-lan", workspaceId: "w1" } })
    })

    it("refuses once the room was revoked from the agent", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentEntity, { ...OPEN_AGENT, assignableRooms: [] }],
                [WorkspaceMemberEntity, LAN],
            ],
        })
        const { service } = await build(em)

        await expect(service.canAssign("m-lan", "a1")).resolves.toBe(false)
    })

    it("refuses a member or agent that does not exist", async () => {
        const absentMember = mockEntityManager({
            findOne: [
                [AgentEntity, OPEN_AGENT],
                [WorkspaceMemberEntity, null],
            ],
        })
        await expect((await build(absentMember)).service.canAssign("ghost", "a1")).resolves.toBe(false)
        const { service } = await build(mockEntityManager({ findOne: [AgentEntity, null] }))

        await expect(service.canAssign("m-lan", "ghost")).resolves.toBe(false)
    })
})

describe("AgentOwnershipService memberIdOf", () => {
    it("answers the member row of the signed-in account", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, seatOf({ id: "m-minh" })] })
        const { service, members } = await build(em)

        await expect(service.memberIdOf("u1", "w1")).resolves.toBe("m-minh")
        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            select: { id: true },
            where: { workspaceId: "w1", userId: "u1" },
        })
    })

    it("refuses an account whose row cannot be read back", async () => {
        const { service } = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, null] }))

        await expect(service.memberIdOf("u1", "w1")).rejects.toMatchObject({
            code: AgentsErrorCode.OwnershipInvalid,
            params: { field: "member" },
        })
    })

    it("refuses a row without an id", async () => {
        const { service } = await build(
            mockEntityManager({ findOne: [WorkspaceMemberEntity, { ...seatOf(), id: null as never }] }),
        )

        await expect(service.memberIdOf("u1", "w1")).rejects.toMatchObject({ code: AgentsErrorCode.OwnershipInvalid })
    })
})

const MINH = seatOf({ id: "m-minh", userId: "u-minh", displayName: "Minh", role: "manager" })
const NAM = seatOf({ id: "m-nam", userId: "u-nam", displayName: "Nam", role: "owner" })
const TARGET = agentEntityOf({ id: "a2", name: "Accounting AI", module: "accounting" })

/** The world one ownership read sees: the agent, its seats, the workspace owner, its tag targets, then the room lookups in call order. */
const ownershipWorld = (
    seats: ReadonlyArray<WorkspaceMemberEntity>,
    owner: string | null,
    agent: AgentEntity = OWNERSHIP,
) => {
    const em = mockEntityManager({
        findOne: [AgentEntity, agent],
        find: [
            [WorkspaceMemberEntity, seats],
            [AgentEntity, [TARGET]],
        ],
        query: [FIND_WORKSPACE_OWNER, ownerRow(owner)],
    })
    return { em, rooms: roomsOf([{ userId: "u-minh", key: "sales" }]) }
}

describe("AgentOwnershipService ownershipOf", () => {
    it("shows the owner, the fallback, who may give the agent work and whom it may tag", async () => {
        const { em, rooms } = ownershipWorld([MINH, NAM], "m-nam")
        const { service, members } = await build(em, rooms)

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
        const { em, rooms } = ownershipWorld([{ ...MINH, status: "disabled" }, NAM], "m-nam")
        const { service } = await build(em, rooms)

        await expect(service.ownershipOf("u1", "w1", "a1")).resolves.toMatchObject({
            owner: { memberId: "m-minh", active: false },
            responder: { ownerMemberId: "m-nam", fallbackMemberId: null },
        })
    })

    it("shows no card for a member who left", async () => {
        const { em, rooms } = ownershipWorld([NAM], "m-nam")
        const { service } = await build(em, rooms)

        await expect(service.ownershipOf("u1", "w1", "a1")).resolves.toMatchObject({
            owner: null,
            fallback: { memberId: "m-nam" },
            responder: { ownerMemberId: "m-nam" },
        })
    })

    it("refuses when the whole chain is gone", async () => {
        const { em, rooms } = ownershipWorld([], null)
        const { service } = await build(em, rooms)

        await expect(service.ownershipOf("u1", "w1", "a1")).rejects.toMatchObject({
            code: AgentsErrorCode.OwnerUnavailable,
        })
    })

    it("refuses an agent of another workspace", async () => {
        const other = { ...OWNERSHIP, workspaceId: "w2" }
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
const writable = (counts: { members?: number; agents?: number; affected?: number } = {}) =>
    mockEntityManager({
        count: [
            [WorkspaceMemberEntity, counts.members ?? 2],
            [AgentEntity, counts.agents ?? 1],
        ],
        update: [AgentEntity, { affected: counts.affected ?? 1 }],
    })

describe("AgentOwnershipService setOwnership", () => {
    it("replaces the ownership of an agent with each id once; a manager only", async () => {
        const em = writable()
        const { service, members } = await build(em)

        await service.setOwnership("u1", "w1", "a1", CHANGE)

        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
        expect(em.count).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: {
                workspaceId: "w1",
                id: expect.objectContaining({ _value: ["m-minh", "m-nam"] }),
                status: "active",
            },
        })
        expect(em.count).toHaveBeenCalledWith(AgentEntity, {
            where: { workspaceId: "w1", id: expect.objectContaining({ _value: ["a2"] }) },
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
        const em = writable({ members: 1 })
        const { service } = await build(em)

        await service.setOwnership("u1", "w1", "a1", { ...CHANGE, fallbackMemberId: "m-minh", canTagAgentIds: [] })

        expect(em.count).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "w1", id: expect.objectContaining({ _value: ["m-minh"] }), status: "active" },
        })
        expect(em.count).not.toHaveBeenCalledWith(AgentEntity, expect.anything())
    })

    it("refuses an owner who is not an active member of the workspace", async () => {
        const { service } = await build(writable({ members: 1 }))

        await expect(service.setOwnership("u1", "w1", "a1", CHANGE)).rejects.toMatchObject({
            code: AgentsErrorCode.OwnershipInvalid,
            params: { field: "owner" },
        })
    })

    it("refuses a count the database cannot answer", async () => {
        const { service } = await build(writable({ members: 0 }))

        await expect(service.setOwnership("u1", "w1", "a1", CHANGE)).rejects.toMatchObject({
            params: { field: "owner" },
        })
    })
})

describe("AgentOwnershipService setOwnership refusals", () => {
    it("refuses a role that does not exist", async () => {
        const { service } = await build(writable())

        await expect(
            service.setOwnership("u1", "w1", "a1", { ...CHANGE, assignableRoles: ["boss"] }),
        ).rejects.toMatchObject({ params: { field: "assignableRoles" } })
    })

    it("refuses a room that does not exist", async () => {
        const { service } = await build(writable())

        await expect(
            service.setOwnership("u1", "w1", "a1", { ...CHANGE, assignableRooms: ["garage"] }),
        ).rejects.toMatchObject({ params: { field: "assignableRooms" } })
    })

    it("refuses an agent that tags itself", async () => {
        const { service } = await build(writable())

        await expect(
            service.setOwnership("u1", "w1", "a1", { ...CHANGE, canTagAgentIds: ["a1"] }),
        ).rejects.toMatchObject({ params: { field: "canTagAgentIds" } })
    })

    it("refuses a tag target of another workspace", async () => {
        const { service } = await build(writable({ agents: 0 }))

        await expect(service.setOwnership("u1", "w1", "a1", CHANGE)).rejects.toMatchObject({
            params: { field: "canTagAgentIds" },
        })
    })

    it("refuses an agent that is not in the workspace", async () => {
        const { service } = await build(writable({ affected: 0 }))

        await expect(service.setOwnership("u1", "w1", "ghost", CHANGE)).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
        })
    })
})
