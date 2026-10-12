import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import type { MemberRow } from "./persistence/workspace-members.rows"
import { FIND_MEMBER, LIST_MEMBERS, UPSERT_MEMBER } from "./persistence/workspace-members.sql"
import type { AccountDirectory } from "./workspace-members.contracts"
import { ACCOUNT_DIRECTORY } from "./workspace-members.port"
import { WorkspaceMembersService } from "./workspace-members.service"

const rowOf = builder<MemberRow>({
    workspace_id: "ws-1",
    user_id: "user-1",
    role: "staff",
    staff_id: null,
    display_name: "An",
    status: "active",
})

const accountOf = () => ({
    id: "user-1",
    email: "an@example.test",
    lastSignInAt: "2026-10-01T00:00:00.000Z",
    avatarUrl: null,
    displayName: "An",
})

const build = async (entityManager: MockEntityManager) => {
    const auth = mock<AccountDirectory>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceMembersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ACCOUNT_DIRECTORY, useValue: auth },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceMembersService), auth }
}

describe("WorkspaceMembersService", () => {
    describe("require", () => {
        it("answers the active membership", async () => {
            const em = mockEntityManager({ query: [FIND_MEMBER, [rowOf({ staff_id: "staff-1" })]] })
            const { service } = await build(em)

            await expect(service.require("user-1", "ws-1")).resolves.toEqual({
                userId: "user-1",
                workspaceId: "ws-1",
                role: "staff",
                staffId: "staff-1",
                displayName: "An",
                status: "active",
            })
            expect(em.query).toHaveBeenCalledWith(FIND_MEMBER, ["ws-1", "user-1"])
        })

        it("refuses a person who is not in the workspace", async () => {
            const { service } = await build(mockEntityManager({ query: [FIND_MEMBER, []] }))

            await expect(service.require("user-1", "ws-9")).rejects.toMatchObject({
                code: WorkspaceMembersErrorCode.NotMember,
            })
        })

        it("refuses a member whose role is not allowed", async () => {
            const { service } = await build(mockEntityManager({ query: [FIND_MEMBER, [rowOf()]] }))

            await expect(service.require("user-1", "ws-1", ["owner", "manager"])).rejects.toMatchObject({
                code: WorkspaceMembersErrorCode.RoleForbidden,
            })
        })
    })

    describe("list", () => {
        it("lists emails and sign-ins for a manager viewer", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_MEMBER, [rowOf({ role: "owner" })]],
                    [LIST_MEMBERS, [rowOf({ role: "owner" })]],
                ],
            })
            const { service, auth } = await build(em)
            auth.accountOf.mockResolvedValue(ok(accountOf()))

            await expect(service.list("user-1", "ws-1")).resolves.toEqual([
                {
                    userId: "user-1",
                    workspaceId: "ws-1",
                    role: "owner",
                    staffId: null,
                    displayName: "An",
                    status: "active",
                    email: "an@example.test",
                    lastSignInAt: "2026-10-01T00:00:00.000Z",
                },
            ])
            expect(em.query).toHaveBeenCalledWith(LIST_MEMBERS, ["ws-1"])
            expect(auth.accountOf).toHaveBeenCalledWith("user-1")
        })

        it("blanks contact details for a staff viewer", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_MEMBER, [rowOf()]],
                    [LIST_MEMBERS, [rowOf()]],
                ],
            })
            const { service, auth } = await build(em)

            await expect(service.list("user-1", "ws-1")).resolves.toMatchObject([{ email: "", lastSignInAt: null }])
            expect(auth.accountOf).not.toHaveBeenCalled()
        })

        it("blanks contact details for a member whose account Auth does not know", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_MEMBER, [rowOf({ role: "manager" })]],
                    [LIST_MEMBERS, [rowOf()]],
                ],
            })
            const { service, auth } = await build(em)
            auth.accountOf.mockResolvedValue(refused("ACCOUNT_NOT_FOUND"))

            await expect(service.list("user-1", "ws-1")).resolves.toMatchObject([{ email: "", lastSignInAt: null }])
        })

        it("refuses a caller who is not in the workspace", async () => {
            const { service } = await build(mockEntityManager({ query: [FIND_MEMBER, []] }))

            await expect(service.list("user-1", "ws-9")).rejects.toMatchObject({
                code: WorkspaceMembersErrorCode.NotMember,
            })
        })
    })

    describe("join", () => {
        it("creates or reactivates the membership", async () => {
            const em = mockEntityManager({ query: [UPSERT_MEMBER, []] })
            const { service } = await build(em)

            await service.join({
                workspaceId: "ws-1",
                userId: "user-2",
                role: "staff",
                staffId: "staff-1",
                displayName: "Binh",
            })

            expect(em.query).toHaveBeenCalledWith(UPSERT_MEMBER, ["ws-1", "user-2", "staff", "staff-1", "Binh"])
        })
    })
})
