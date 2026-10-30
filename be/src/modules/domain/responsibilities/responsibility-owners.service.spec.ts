import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AGENT_DIRECTORY } from "@modules/domain/messages"
import type { AgentDirectory } from "@modules/domain/messages"
import { MemberLookupService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { ResponsibilityOwnersService } from "./responsibility-owners.service"

/** The statement `callDbFunction` runs to find the owner seat. */
const FIND_WORKSPACE_OWNER = 'SELECT * FROM "public"."workspace_owner_member"($1)'

const MEMBER_ID = "11111111-1111-4111-8111-111111111111"
const AGENT_ID = "22222222-2222-4222-8222-222222222222"

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const members = mock<MemberLookupService>()
    members.activeById.mockResolvedValue(null)
    members.byId.mockResolvedValue(null)
    members.activeNamed.mockResolvedValue(null)
    const agents = mock<AgentDirectory>()
    agents.agentById.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ResponsibilityOwnersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MemberLookupService, useValue: members },
            { provide: AGENT_DIRECTORY, useValue: agents },
        ],
    }).compile()
    return { service: moduleRef.get(ResponsibilityOwnersService), members, agents }
}

describe("ResponsibilityOwnersService > resolve", () => {
    it("makes a member of the workspace the owner under the member's name", async () => {
        const { service, members, agents } = await build()
        members.activeById.mockResolvedValue({ id: MEMBER_ID, displayName: "Anh Minh" })

        await expect(service.resolve("ws-1", MEMBER_ID)).resolves.toEqual({
            kind: "human",
            agentId: null,
            memberId: MEMBER_ID,
            name: "Anh Minh",
        })
        expect(members.activeById).toHaveBeenCalledWith("ws-1", MEMBER_ID)
        expect(agents.agentById).not.toHaveBeenCalled()
    })

    it("makes an agent of the workspace the owner when no member has the id", async () => {
        const { service, members, agents } = await build()
        agents.agentById.mockResolvedValue({ id: AGENT_ID, name: "Sales AI" })

        await expect(service.resolve("ws-1", AGENT_ID)).resolves.toEqual({
            kind: "agent",
            agentId: AGENT_ID,
            memberId: null,
            name: "Sales AI",
        })
        expect(members.activeById).toHaveBeenCalledWith("ws-1", AGENT_ID)
        expect(agents.agentById).toHaveBeenCalledWith("ws-1", AGENT_ID)
    })

    it("refuses an id that is neither a member nor an agent of the workspace", async () => {
        const { service } = await build()

        await expect(service.resolve("ws-1", AGENT_ID)).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.OwnerNotFound,
            params: { id: AGENT_ID },
        })
    })

    it("refuses the old generic label without looking anything up", async () => {
        const { service, members, agents } = await build()

        await expect(service.resolve("ws-1", "human")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.OwnerNotFound,
            params: { id: "human" },
        })
        expect(members.activeById).not.toHaveBeenCalled()
        expect(agents.agentById).not.toHaveBeenCalled()
    })
})

describe("ResponsibilityOwnersService > the defaults", () => {
    it("answers the workspace owner seat as an owner", async () => {
        const em = mockEntityManager({ query: [FIND_WORKSPACE_OWNER, [{ workspace_owner_member: MEMBER_ID }]] })
        const { service, members } = await build(em)
        members.byId.mockResolvedValue({ id: MEMBER_ID, displayName: "Chu Van" })

        await expect(service.workspaceOwner("ws-1")).resolves.toEqual({
            kind: "human",
            agentId: null,
            memberId: MEMBER_ID,
            name: "Chu Van",
        })
        expect(members.byId).toHaveBeenCalledWith(MEMBER_ID)
    })

    it("refuses when the workspace has no active owner seat", async () => {
        const { service, members } = await build(
            mockEntityManager({ query: [FIND_WORKSPACE_OWNER, [{ workspace_owner_member: null }]] }),
        )

        await expect(service.workspaceOwner("ws-1")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.OwnerNotFound,
            params: { id: "ws-1" },
        })
        expect(members.byId).not.toHaveBeenCalled()
    })

    it("refuses when the owner seat function names a seat that has no member row", async () => {
        const { service } = await build(
            mockEntityManager({ query: [FIND_WORKSPACE_OWNER, [{ workspace_owner_member: MEMBER_ID }]] }),
        )

        await expect(service.workspaceOwner("ws-1")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.OwnerNotFound,
        })
    })

    it("answers the active member who carries a name, or null when none does", async () => {
        const { service, members } = await build()
        members.activeNamed.mockResolvedValueOnce({ id: MEMBER_ID, displayName: "Linh" })

        await expect(service.memberNamed("ws-1", "linh")).resolves.toEqual({
            kind: "human",
            agentId: null,
            memberId: MEMBER_ID,
            name: "Linh",
        })
        await expect(service.memberNamed("ws-1", "Ghost")).resolves.toBeNull()
        expect(members.activeNamed).toHaveBeenNthCalledWith(1, "ws-1", "linh")
    })
})
