import { Test } from "@nestjs/testing"
import { agentMemberOf as memberOf } from "@tests/fixtures/builders/agents.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentOwnershipService } from "./agent-ownership.service"
import { AgentsErrorCode } from "./errors/agents.error"
import {
    COUNT_ACTIVE_MEMBERS,
    COUNT_WORKSPACE_AGENTS,
    FIND_ASSIGN_CONTEXT,
    FIND_MEMBER_ID,
    FIND_OWNERSHIP,
    FIND_TAG_CONTEXT,
    FIND_WORKSPACE_OWNER,
    LIST_ACTIVE_MEMBER_IDS,
    LIST_MEMBER_STATES,
    LIST_ROOM_LABELS,
    LIST_TAG_TARGETS,
    SET_OWNERSHIP,
} from "./persistence/agents.sql"
import type { OwnershipRow } from "./persistence/ownership.rows"

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(memberOf())) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentOwnershipService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(AgentOwnershipService), members }
}

const OWNERSHIP: OwnershipRow = {
    id: "a1",
    workspace_id: "w1",
    name: "AI Sales",
    status: "active",
    owner_member_id: "m-minh",
    fallback_member_id: "m-nam",
    assignable_roles: ["owner", "manager"],
    assignable_rooms: ["sales"],
    can_tag_agent_ids: ["a2"],
}

describe("AgentOwnershipService ownerOf", () => {
    it("answers the owner and the fallback while both are active", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OWNERSHIP, [OWNERSHIP]],
                [LIST_ACTIVE_MEMBER_IDS, [{ id: "m-minh" }, { id: "m-nam" }]],
                [FIND_WORKSPACE_OWNER, [{ id: "m-nam" }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-minh", fallbackMemberId: "m-nam" })
        expect(em.query).toHaveBeenCalledWith(FIND_OWNERSHIP, ["a1"])
        expect(em.query).toHaveBeenCalledWith(LIST_ACTIVE_MEMBER_IDS, ["w1", ["m-minh", "m-nam"]])
        expect(em.query).toHaveBeenCalledWith(FIND_WORKSPACE_OWNER, ["w1"])
    })

    it("falls back when the owner left the workspace", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OWNERSHIP, [OWNERSHIP]],
                [LIST_ACTIVE_MEMBER_IDS, [{ id: "m-nam" }]],
                [FIND_WORKSPACE_OWNER, [{ id: "m-nam" }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-nam", fallbackMemberId: null })
    })

    it("falls back to the workspace owner when the owner and the fallback are both gone", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OWNERSHIP, [OWNERSHIP]],
                [LIST_ACTIVE_MEMBER_IDS, []],
                [FIND_WORKSPACE_OWNER, [{ id: "m-ceo" }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-ceo", fallbackMemberId: null })
    })

    it("asks the active list only about the members the agent names", async () => {
        const legacy = { ...OWNERSHIP, owner_member_id: null, fallback_member_id: null }
        const em = mockEntityManager({
            query: [
                [FIND_OWNERSHIP, [legacy]],
                [LIST_ACTIVE_MEMBER_IDS, []],
                [FIND_WORKSPACE_OWNER, [{ id: "m-ceo" }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.ownerOf("a1")).resolves.toEqual({ ownerMemberId: "m-ceo", fallbackMemberId: null })
        expect(em.query).toHaveBeenCalledWith(LIST_ACTIVE_MEMBER_IDS, ["w1", []])
    })

    it("refuses when nobody in the chain is active", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OWNERSHIP, [OWNERSHIP]],
                [LIST_ACTIVE_MEMBER_IDS, []],
                [FIND_WORKSPACE_OWNER, []],
            ],
        })
        const { service } = await build(em)

        await expect(service.ownerOf("a1")).rejects.toMatchObject({ code: AgentsErrorCode.OwnerUnavailable })
    })

    it("refuses an agent that does not exist", async () => {
        const { service } = await build(mockEntityManager({ query: [FIND_OWNERSHIP, []] }))

        await expect(service.ownerOf("ghost")).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
            params: { id: "ghost" },
        })
    })
})

const TAG_CONTEXT = {
    from_status: "active",
    to_status: "active",
    same_workspace: true,
    listed: true,
    same_agent: false,
}

describe("AgentOwnershipService canTag", () => {
    it("admits a listed agent", async () => {
        const em = mockEntityManager({ query: [FIND_TAG_CONTEXT, [TAG_CONTEXT]] })
        const { service } = await build(em)

        await expect(service.canTag("a1", "a2")).resolves.toBe(true)
        expect(em.query).toHaveBeenCalledWith(FIND_TAG_CONTEXT, ["a1", "a2"])
    })

    it("refuses an agent that is not on the list", async () => {
        const em = mockEntityManager({ query: [FIND_TAG_CONTEXT, [{ ...TAG_CONTEXT, listed: false }]] })
        const { service } = await build(em)

        await expect(service.canTag("a1", "a3")).resolves.toBe(false)
    })

    it("refuses an agent that does not exist", async () => {
        const { service } = await build(mockEntityManager({ query: [FIND_TAG_CONTEXT, []] }))

        await expect(service.canTag("a1", "ghost")).resolves.toBe(false)
    })
})

const ASSIGN_CONTEXT = {
    role: "staff",
    member_status: "active",
    agent_status: "active",
    assignable_roles: ["owner", "manager"],
    assignable_rooms: ["sales"],
    member_rooms: ["sales"],
}

describe("AgentOwnershipService canAssign", () => {
    it("admits a staff member who sits in an open room", async () => {
        const em = mockEntityManager({ query: [FIND_ASSIGN_CONTEXT, [ASSIGN_CONTEXT]] })
        const { service } = await build(em)

        await expect(service.canAssign("m-lan", "a1")).resolves.toBe(true)
        expect(em.query).toHaveBeenCalledWith(FIND_ASSIGN_CONTEXT, ["a1", "m-lan"])
    })

    it("refuses once the room was revoked from the agent", async () => {
        const em = mockEntityManager({ query: [FIND_ASSIGN_CONTEXT, [{ ...ASSIGN_CONTEXT, assignable_rooms: [] }]] })
        const { service } = await build(em)

        await expect(service.canAssign("m-lan", "a1")).resolves.toBe(false)
    })

    it("refuses a member or agent that does not exist", async () => {
        const { service } = await build(mockEntityManager({ query: [FIND_ASSIGN_CONTEXT, []] }))

        await expect(service.canAssign("ghost", "a1")).resolves.toBe(false)
    })
})

describe("AgentOwnershipService memberIdOf", () => {
    it("answers the member row of the signed-in account", async () => {
        const em = mockEntityManager({ query: [FIND_MEMBER_ID, [{ id: "m-minh" }]] })
        const { service, members } = await build(em)

        await expect(service.memberIdOf("u1", "w1")).resolves.toBe("m-minh")
        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(em.query).toHaveBeenCalledWith(FIND_MEMBER_ID, ["w1", "u1"])
    })

    it("refuses an account whose row cannot be read back", async () => {
        const { service } = await build(mockEntityManager({ query: [FIND_MEMBER_ID, []] }))

        await expect(service.memberIdOf("u1", "w1")).rejects.toMatchObject({
            code: AgentsErrorCode.OwnershipInvalid,
            params: { field: "member" },
        })
    })

    it("refuses a row without an id", async () => {
        const { service } = await build(mockEntityManager({ query: [FIND_MEMBER_ID, [{ id: null }]] }))

        await expect(service.memberIdOf("u1", "w1")).rejects.toMatchObject({ code: AgentsErrorCode.OwnershipInvalid })
    })
})

const MEMBER_STATES = [
    { id: "m-minh", display_name: "Minh", role: "manager", status: "active", room_key: "sales" },
    { id: "m-nam", display_name: "Nam", role: "owner", status: "active", room_key: null },
]
const OWNERSHIP_ANSWERS = [
    [FIND_OWNERSHIP, [OWNERSHIP]],
    [FIND_WORKSPACE_OWNER, [{ id: "m-nam" }]],
    [LIST_ROOM_LABELS, [{ key: "sales", name: "Sales" }]],
    [LIST_TAG_TARGETS, [{ id: "a2", name: "Accounting AI", module: "accounting", status: "active" }]],
] as const

describe("AgentOwnershipService ownershipOf", () => {
    it("shows the owner, the fallback, who may give the agent work and whom it may tag", async () => {
        const em = mockEntityManager({ query: [...OWNERSHIP_ANSWERS, [LIST_MEMBER_STATES, MEMBER_STATES]] })
        const { service, members } = await build(em)

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
        expect(em.query).toHaveBeenCalledWith(LIST_MEMBER_STATES, ["w1", ["m-minh", "m-nam"]])
        expect(em.query).toHaveBeenCalledWith(LIST_ROOM_LABELS, ["w1", ["sales"]])
        expect(em.query).toHaveBeenCalledWith(LIST_TAG_TARGETS, ["w1", ["a2"]])
    })

    it("shows a disabled owner as inactive and answers through the fallback", async () => {
        const disabled = [{ ...MEMBER_STATES[0], status: "disabled" }, MEMBER_STATES[1]]
        const { service } = await build(
            mockEntityManager({ query: [...OWNERSHIP_ANSWERS, [LIST_MEMBER_STATES, disabled]] }),
        )

        await expect(service.ownershipOf("u1", "w1", "a1")).resolves.toMatchObject({
            owner: { memberId: "m-minh", active: false },
            responder: { ownerMemberId: "m-nam", fallbackMemberId: null },
        })
    })

    it("shows no card for a member who left", async () => {
        const { service } = await build(
            mockEntityManager({ query: [...OWNERSHIP_ANSWERS, [LIST_MEMBER_STATES, [MEMBER_STATES[1]]]] }),
        )

        await expect(service.ownershipOf("u1", "w1", "a1")).resolves.toMatchObject({
            owner: null,
            fallback: { memberId: "m-nam" },
            responder: { ownerMemberId: "m-nam" },
        })
    })

    it("refuses when the whole chain is gone", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OWNERSHIP, [OWNERSHIP]],
                [LIST_MEMBER_STATES, []],
                [FIND_WORKSPACE_OWNER, []],
                [LIST_ROOM_LABELS, []],
                [LIST_TAG_TARGETS, []],
            ],
        })
        const { service } = await build(em)

        await expect(service.ownershipOf("u1", "w1", "a1")).rejects.toMatchObject({
            code: AgentsErrorCode.OwnerUnavailable,
        })
    })

    it("refuses an agent of another workspace", async () => {
        const other = { ...OWNERSHIP, workspace_id: "w2" }
        const { service } = await build(mockEntityManager({ query: [FIND_OWNERSHIP, [other]] }))

        await expect(service.ownershipOf("u1", "w1", "a1")).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
        })
    })

    it("refuses an agent that does not exist", async () => {
        const { service } = await build(mockEntityManager({ query: [FIND_OWNERSHIP, []] }))

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
const WRITABLE = [
    [COUNT_ACTIVE_MEMBERS, [{ n: 2 }]],
    [COUNT_WORKSPACE_AGENTS, [{ n: 1 }]],
    [SET_OWNERSHIP, [{ id: "a1" }]],
] as const

describe("AgentOwnershipService setOwnership", () => {
    it("replaces the ownership of an agent with each id once; a manager only", async () => {
        const em = mockEntityManager({ query: WRITABLE })
        const { service, members } = await build(em)

        await service.setOwnership("u1", "w1", "a1", CHANGE)

        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
        expect(em.query).toHaveBeenCalledWith(COUNT_ACTIVE_MEMBERS, ["w1", ["m-minh", "m-nam"]])
        expect(em.query).toHaveBeenCalledWith(COUNT_WORKSPACE_AGENTS, ["w1", ["a2"]])
        expect(em.query).toHaveBeenCalledWith(SET_OWNERSHIP, [
            "a1",
            "w1",
            "m-minh",
            "m-nam",
            ["manager"],
            ["sales"],
            ["a2"],
        ])
    })

    it("accepts an owner who is also the fallback and an empty tag list without counting agents", async () => {
        const em = mockEntityManager({
            query: [
                [COUNT_ACTIVE_MEMBERS, [{ n: 1 }]],
                [SET_OWNERSHIP, [{ id: "a1" }]],
            ],
        })
        const { service } = await build(em)

        await service.setOwnership("u1", "w1", "a1", { ...CHANGE, fallbackMemberId: "m-minh", canTagAgentIds: [] })

        expect(em.query).toHaveBeenCalledWith(COUNT_ACTIVE_MEMBERS, ["w1", ["m-minh"]])
        expect(em.query).not.toHaveBeenCalledWith(COUNT_WORKSPACE_AGENTS, expect.anything())
    })

    it("refuses an owner who is not an active member of the workspace", async () => {
        const { service } = await build(mockEntityManager({ query: [COUNT_ACTIVE_MEMBERS, [{ n: 1 }]] }))

        await expect(service.setOwnership("u1", "w1", "a1", CHANGE)).rejects.toMatchObject({
            code: AgentsErrorCode.OwnershipInvalid,
            params: { field: "owner" },
        })
    })

    it("refuses a count the database cannot answer", async () => {
        const { service } = await build(mockEntityManager({ query: [COUNT_ACTIVE_MEMBERS, []] }))

        await expect(service.setOwnership("u1", "w1", "a1", CHANGE)).rejects.toMatchObject({
            params: { field: "owner" },
        })
    })
})

describe("AgentOwnershipService setOwnership refusals", () => {
    it("refuses a role that does not exist", async () => {
        const { service } = await build(mockEntityManager({ query: WRITABLE }))

        await expect(
            service.setOwnership("u1", "w1", "a1", { ...CHANGE, assignableRoles: ["boss"] }),
        ).rejects.toMatchObject({ params: { field: "assignableRoles" } })
    })

    it("refuses a room that does not exist", async () => {
        const { service } = await build(mockEntityManager({ query: WRITABLE }))

        await expect(
            service.setOwnership("u1", "w1", "a1", { ...CHANGE, assignableRooms: ["garage"] }),
        ).rejects.toMatchObject({ params: { field: "assignableRooms" } })
    })

    it("refuses an agent that tags itself", async () => {
        const { service } = await build(mockEntityManager({ query: WRITABLE }))

        await expect(
            service.setOwnership("u1", "w1", "a1", { ...CHANGE, canTagAgentIds: ["a1"] }),
        ).rejects.toMatchObject({ params: { field: "canTagAgentIds" } })
    })

    it("refuses a tag target of another workspace", async () => {
        const em = mockEntityManager({
            query: [
                [COUNT_ACTIVE_MEMBERS, [{ n: 2 }]],
                [COUNT_WORKSPACE_AGENTS, [{ n: 0 }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.setOwnership("u1", "w1", "a1", CHANGE)).rejects.toMatchObject({
            params: { field: "canTagAgentIds" },
        })
    })

    it("refuses an agent that is not in the workspace", async () => {
        const em = mockEntityManager({
            query: [
                [COUNT_ACTIVE_MEMBERS, [{ n: 2 }]],
                [COUNT_WORKSPACE_AGENTS, [{ n: 1 }]],
                [SET_OWNERSHIP, []],
            ],
        })
        const { service } = await build(em)

        await expect(service.setOwnership("u1", "w1", "ghost", CHANGE)).rejects.toMatchObject({
            code: AgentsErrorCode.AgentNotFound,
        })
    })
})
