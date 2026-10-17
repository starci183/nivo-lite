import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EventsService } from "@modules/domain/events"
import { StaffService } from "@modules/domain/staff"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import type { MemberRow } from "./persistence/workspace-members.rows"
import {
    DELETE_MEMBER,
    FIND_MEMBER,
    LIST_MEMBERS,
    RENAME_MEMBER_EVERYWHERE,
    UPDATE_MEMBER_ROLE,
    UPDATE_MEMBER_STATUS,
    UPSERT_MEMBER,
} from "./persistence/workspace-members.sql"
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
    const events = mock<EventsService>()
    const staff = mock<StaffService>()
    events.record.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceMembersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ACCOUNT_DIRECTORY, useValue: auth },
            { provide: EventsService, useValue: events },
            { provide: StaffService, useValue: staff },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceMembersService), auth, events, staff }
}

describe("WorkspaceMembersService / require", () => {
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

describe("WorkspaceMembersService / list", () => {
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

describe("WorkspaceMembersService / join", () => {
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

describe("WorkspaceMembersService / staff directory", () => {
    const saved = {
        id: "staff-2",
        workspace_id: "ws-1",
        name: "Binh",
        role: "Sales",
        email: "binh@example.test",
        active: false,
        created_at: "2026-10-01T00:00:00.000Z",
    }
    const option = { id: saved.id, name: saved.name, role: saved.role, email: saved.email, active: saved.active }
    it("saves staff after proving the caller is a manager and returns the console fields", async () => {
        const em = mockEntityManager({ query: [FIND_MEMBER, [rowOf({ role: "manager" })]] })
        const { service, staff } = await build(em)
        staff.save.mockResolvedValue(saved)
        const input = {
            workspaceId: "ws-1",
            id: "staff-2",
            name: "Binh",
            role: "Sales",
            email: "binh@example.test",
            active: false,
        }

        await expect(service.saveStaff("user-1", input)).resolves.toEqual(option)
        expect(em.query).toHaveBeenCalledWith(FIND_MEMBER, ["ws-1", "user-1"])
        expect(staff.save).toHaveBeenCalledWith(input)
    })

    it("refuses staff callers before saving", async () => {
        const { service, staff } = await build(mockEntityManager({ query: [FIND_MEMBER, [rowOf()]] }))

        await expect(
            service.saveStaff("user-1", {
                workspaceId: "ws-1",
                id: null,
                name: "Binh",
                role: "Sales",
                email: null,
                active: true,
            }),
        ).rejects.toMatchObject({ code: WorkspaceMembersErrorCode.RoleForbidden })
        expect(staff.save).not.toHaveBeenCalled()
    })

    it("lists staff for an active member and returns only the console fields", async () => {
        const em = mockEntityManager({ query: [FIND_MEMBER, [rowOf()]] })
        const { service, staff } = await build(em)
        staff.list.mockResolvedValue([saved])

        await expect(service.listStaff("user-1", "ws-1")).resolves.toEqual([option])
        expect(em.query).toHaveBeenCalledWith(FIND_MEMBER, ["ws-1", "user-1"])
        expect(staff.list).toHaveBeenCalledWith("ws-1")
    })
})

describe("WorkspaceMembersService", () => {
    it("presents the caller's workspace role", async () => {
        const em = mockEntityManager({ query: [FIND_MEMBER, [rowOf({ role: "owner" })]] })
        const { service } = await build(em)

        await expect(service.roleOf("user-1", "ws-1")).resolves.toBe("owner")
        expect(em.query).toHaveBeenCalledWith(FIND_MEMBER, ["ws-1", "user-1"])
    })

    it("renames the account in every active workspace with trimmed text", async () => {
        const em = mockEntityManager({ query: [RENAME_MEMBER_EVERYWHERE, []] })
        const { service } = await build(em)

        await expect(service.renameSelf("user-1", "  An Nguyen  ")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(RENAME_MEMBER_EVERYWHERE, ["user-1", "An Nguyen"])
    })
})

describe("WorkspaceMembersService / seat changes", () => {
    const actor = rowOf({ role: "owner", display_name: "Chu" })
    const target = rowOf({ user_id: "user-2", display_name: "Binh" })
    const seats = () =>
        [
            [FIND_MEMBER, [actor]],
            [FIND_MEMBER, [target]],
        ] as const
    it("changes a role and records the exact change", async () => {
        const em = mockEntityManager({
            query: [...seats(), [UPDATE_MEMBER_ROLE, [{ user_id: "user-2" }]]] as const,
        })
        const { service, events } = await build(em)

        await expect(service.changeRole("user-1", "ws-1", "user-2", "manager")).resolves.toBeUndefined()
        expect(em.query.mock.calls).toEqual([
            [FIND_MEMBER, ["ws-1", "user-1"]],
            [FIND_MEMBER, ["ws-1", "user-2"]],
            [UPDATE_MEMBER_ROLE, ["ws-1", "user-2", "manager"]],
        ])
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "member.role_changed",
            actor: "Chu",
            summary: "Binh: staff -> manager",
        })
    })

    it("leaves an identical role unchanged without recording an event", async () => {
        const em = mockEntityManager({ query: seats() })
        const { service, events } = await build(em)

        await expect(service.changeRole("user-1", "ws-1", "user-2", "staff")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledTimes(2)
        expect(events.record).not.toHaveBeenCalled()
    })

    it.each([
        ["disabled", "member.disabled"],
        ["active", "member.enabled"],
    ] as const)("sets status %s and records %s", async (status, kind) => {
        const em = mockEntityManager({
            query: [...seats(), [UPDATE_MEMBER_STATUS, [{ user_id: "user-2" }]]] as const,
        })
        const { service, events } = await build(em)

        await expect(service.setStatus("user-1", "ws-1", "user-2", status)).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(UPDATE_MEMBER_STATUS, ["ws-1", "user-2", status])
        expect(events.record).toHaveBeenCalledWith({ workspaceId: "ws-1", kind, actor: "Chu", summary: "Binh" })
    })

    it("removes a member and records their name", async () => {
        const em = mockEntityManager({ query: [...seats(), [DELETE_MEMBER, [{ user_id: "user-2" }]]] as const })
        const { service, events } = await build(em)

        await expect(service.remove("user-1", "ws-1", "user-2")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(DELETE_MEMBER, ["ws-1", "user-2"])
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "member.removed",
            actor: "Chu",
            summary: "Binh",
        })
    })
})

describe("WorkspaceMembersService / seat changes", () => {
    const actor = rowOf({ role: "owner", display_name: "Chu" })
    const target = rowOf({ user_id: "user-2", display_name: "Binh" })
    const seats = () =>
        [
            [FIND_MEMBER, [actor]],
            [FIND_MEMBER, [target]],
        ] as const
    it("refuses an absent target before writing or recording an event", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_MEMBER, [actor]],
                [FIND_MEMBER, []],
            ],
        })
        const { service, events } = await build(em)

        await expect(service.remove("user-1", "ws-1", "user-2")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.MemberNotFound,
        })
        expect(em.query).toHaveBeenCalledTimes(2)
        expect(events.record).not.toHaveBeenCalled()
    })

    it("refuses removing one's own account before writing", async () => {
        const em = mockEntityManager({ query: [FIND_MEMBER, [actor]] })
        const { service, events } = await build(em)

        await expect(service.remove("user-1", "ws-1", "user-1")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.SelfForbidden,
        })
        expect(em.query).toHaveBeenCalledTimes(2)
        expect(events.record).not.toHaveBeenCalled()
    })

    it("refuses when the target disappears before the update", async () => {
        const em = mockEntityManager({ query: [...seats(), [UPDATE_MEMBER_ROLE, []]] })
        const { service, events } = await build(em)

        await expect(service.changeRole("user-1", "ws-1", "user-2", "manager")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.MemberNotFound,
        })
        expect(em.query).toHaveBeenCalledWith(UPDATE_MEMBER_ROLE, ["ws-1", "user-2", "manager"])
        expect(events.record).not.toHaveBeenCalled()
    })

    it("translates a last-owner database refusal and preserves its cause", async () => {
        const em = mockEntityManager()
        const cause = new Error("workspace_members guard: last_owner")
        em.query.mockResolvedValueOnce([actor]).mockResolvedValueOnce([target]).mockRejectedValueOnce(cause)
        const { service, events } = await build(em)

        await expect(service.remove("user-1", "ws-1", "user-2")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.LastOwner,
            cause,
        })
        expect(em.query).toHaveBeenCalledWith(DELETE_MEMBER, ["ws-1", "user-2"])
        expect(events.record).not.toHaveBeenCalled()
    })

    it.each([new Error("database offline"), { message: "last_owner" }])(
        "propagates an unrelated database failure unchanged: %p",
        async (cause) => {
            const em = mockEntityManager()
            em.query.mockResolvedValueOnce([actor]).mockResolvedValueOnce([target]).mockRejectedValueOnce(cause)
            const { service, events } = await build(em)

            await expect(service.remove("user-1", "ws-1", "user-2")).rejects.toBe(cause)
            expect(em.query).toHaveBeenCalledWith(DELETE_MEMBER, ["ws-1", "user-2"])
            expect(events.record).not.toHaveBeenCalled()
        },
    )
})
