import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import {
    FIND_MEMBER_BY_NAME,
    FIND_OWNER_AGENT,
    FIND_OWNER_MEMBER,
    FIND_WORKSPACE_OWNER,
} from "./persistence/responsibility-owners.sql"
import { ResponsibilityOwnersService } from "./responsibility-owners.service"

const MEMBER_ID = "11111111-1111-4111-8111-111111111111"
const AGENT_ID = "22222222-2222-4222-8222-222222222222"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ResponsibilityOwnersService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(ResponsibilityOwnersService)
}

describe("ResponsibilityOwnersService > resolve", () => {
    it("makes a member of the workspace the owner under the member's name", async () => {
        const em = mockEntityManager({ query: [FIND_OWNER_MEMBER, [{ id: MEMBER_ID, display_name: "Anh Minh" }]] })
        const service = await build(em)

        await expect(service.resolve(em, "ws-1", MEMBER_ID)).resolves.toEqual({
            kind: "human",
            agentId: null,
            memberId: MEMBER_ID,
            name: "Anh Minh",
        })
        expect(em.query.mock.calls).toEqual([[FIND_OWNER_MEMBER, ["ws-1", MEMBER_ID]]])
    })

    it("makes an agent of the workspace the owner when no member has the id, inside the caller's transaction", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [FIND_OWNER_MEMBER, []],
                    [FIND_OWNER_AGENT, [{ id: AGENT_ID, name: "Sales AI" }]],
                ],
            }),
        )
        const service = await build(mockEntityManager())

        await expect(service.resolve(tx.em, "ws-1", AGENT_ID)).resolves.toEqual({
            kind: "agent",
            agentId: AGENT_ID,
            memberId: null,
            name: "Sales AI",
        })
        expect(tx.em.query.mock.calls.map((call) => call[1])).toEqual([
            ["ws-1", AGENT_ID],
            ["ws-1", AGENT_ID],
        ])
    })

    it("refuses an id that is neither a member nor an agent of the workspace", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OWNER_MEMBER, []],
                [FIND_OWNER_AGENT, []],
            ],
        })
        const service = await build(em)

        await expect(service.resolve(em, "ws-1", AGENT_ID)).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.OwnerNotFound,
            params: { id: AGENT_ID },
        })
    })

    it("refuses the old generic label without looking anything up", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.resolve(em, "ws-1", "human")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.OwnerNotFound,
            params: { id: "human" },
        })
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("ResponsibilityOwnersService > the defaults", () => {
    it("answers the workspace owner seat as an owner", async () => {
        const em = mockEntityManager({ query: [FIND_WORKSPACE_OWNER, [{ id: MEMBER_ID, display_name: "Chu Van" }]] })
        const service = await build(em)

        await expect(service.workspaceOwner("ws-1")).resolves.toEqual({
            kind: "human",
            agentId: null,
            memberId: MEMBER_ID,
            name: "Chu Van",
        })
    })

    it("refuses when the workspace has no active owner seat", async () => {
        const service = await build(mockEntityManager({ query: [FIND_WORKSPACE_OWNER, []] }))

        await expect(service.workspaceOwner("ws-1")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.OwnerNotFound,
            params: { id: "ws-1" },
        })
    })

    it("answers the active member who carries a name, or null when none does", async () => {
        const named = mockEntityManager({ query: [FIND_MEMBER_BY_NAME, [{ id: MEMBER_ID, display_name: "Linh" }]] })
        const nobody = mockEntityManager({ query: [FIND_MEMBER_BY_NAME, []] })

        await expect((await build(named)).memberNamed("ws-1", "linh")).resolves.toEqual({
            kind: "human",
            agentId: null,
            memberId: MEMBER_ID,
            name: "Linh",
        })
        await expect((await build(nobody)).memberNamed("ws-1", "Ghost")).resolves.toBeNull()
        expect(named.query.mock.calls).toEqual([[FIND_MEMBER_BY_NAME, ["ws-1", "linh"]]])
    })
})
