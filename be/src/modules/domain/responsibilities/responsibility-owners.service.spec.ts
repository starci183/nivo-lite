import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { ResponsibilityOwnersService } from "./responsibility-owners.service"

/** The statement `callDbFunction` runs to find the owner seat. */
const FIND_WORKSPACE_OWNER = "SELECT * FROM public.workspace_owner_member($1)"

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
        const em = mockEntityManager()
        const lookup = fakeQueryBuilder({ getRawOne: { id: MEMBER_ID, display_name: "Anh Minh" } })
        answerQueryBuilders(em, lookup)
        const service = await build(em)

        await expect(service.resolve(em, "ws-1", MEMBER_ID)).resolves.toEqual({
            kind: "human",
            agentId: null,
            memberId: MEMBER_ID,
            name: "Anh Minh",
        })
        expect(lookup.argsOf("from")).toEqual([["public.workspace_members", "m"]])
        expect(lookup.argsOf("where")).toEqual([
            [
                "m.workspace_id = :workspaceId AND m.id = :owner AND m.status = 'active'",
                { workspaceId: "ws-1", owner: MEMBER_ID },
            ],
        ])
    })

    it("makes an agent of the workspace the owner when no member has the id, inside the caller's transaction", async () => {
        const em = mockEntityManager()
        const asMember = fakeQueryBuilder({ getRawOne: undefined })
        const asAgent = fakeQueryBuilder({ getRawOne: { id: AGENT_ID, name: "Sales AI" } })
        answerQueryBuilders(em, asMember, asAgent)
        const tx = fakeTransaction(em)
        const service = await build(mockEntityManager())

        await expect(service.resolve(tx.em, "ws-1", AGENT_ID)).resolves.toEqual({
            kind: "agent",
            agentId: AGENT_ID,
            memberId: null,
            name: "Sales AI",
        })
        expect(asMember.argsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", owner: AGENT_ID })
        expect(asAgent.argsOf("from")).toEqual([["public.agents", "a"]])
        expect(asAgent.argsOf("where")).toEqual([
            ["a.workspace_id = :workspaceId AND a.id = :owner", { workspaceId: "ws-1", owner: AGENT_ID }],
        ])
    })

    it("refuses an id that is neither a member nor an agent of the workspace", async () => {
        const em = mockEntityManager()
        answerQueryBuilders(em, fakeQueryBuilder({ getRawOne: undefined }), fakeQueryBuilder({ getRawOne: undefined }))
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
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("ResponsibilityOwnersService > the defaults", () => {
    it("answers the workspace owner seat as an owner", async () => {
        const em = mockEntityManager({ query: [FIND_WORKSPACE_OWNER, [{ workspace_owner_member: MEMBER_ID }]] })
        answerQueryBuilders(em, fakeQueryBuilder({ getRawOne: { id: MEMBER_ID, display_name: "Chu Van" } }))
        const service = await build(em)

        await expect(service.workspaceOwner("ws-1")).resolves.toEqual({
            kind: "human",
            agentId: null,
            memberId: MEMBER_ID,
            name: "Chu Van",
        })
    })

    it("refuses when the workspace has no active owner seat", async () => {
        const service = await build(
            mockEntityManager({ query: [FIND_WORKSPACE_OWNER, [{ workspace_owner_member: null }]] }),
        )

        await expect(service.workspaceOwner("ws-1")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.OwnerNotFound,
            params: { id: "ws-1" },
        })
    })

    it("refuses when the owner seat function names a seat that has no member row", async () => {
        const em = mockEntityManager({ query: [FIND_WORKSPACE_OWNER, [{ workspace_owner_member: MEMBER_ID }]] })
        answerQueryBuilders(em, fakeQueryBuilder({ getRawOne: undefined }))
        const service = await build(em)

        await expect(service.workspaceOwner("ws-1")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.OwnerNotFound,
        })
    })

    it("answers the active member who carries a name, or null when none does", async () => {
        const named = mockEntityManager()
        const nobody = mockEntityManager()
        const lookup = fakeQueryBuilder({ getRawOne: { id: MEMBER_ID, display_name: "Linh" } })
        answerQueryBuilders(named, lookup)
        answerQueryBuilders(nobody, fakeQueryBuilder({ getRawOne: undefined }))

        await expect((await build(named)).memberNamed("ws-1", "linh")).resolves.toEqual({
            kind: "human",
            agentId: null,
            memberId: MEMBER_ID,
            name: "Linh",
        })
        await expect((await build(nobody)).memberNamed("ws-1", "Ghost")).resolves.toBeNull()
        expect(lookup.argsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", name: "linh" })
        expect(lookup.argsOf("orderBy")).toEqual([["m.created_at", "ASC"]])
    })
})
