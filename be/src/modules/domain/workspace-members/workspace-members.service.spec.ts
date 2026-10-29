import { resolveFragments } from "@tests/fixtures/builders/sql-fragments.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EventsService } from "@modules/domain/events"
import { StaffService } from "@modules/domain/staff"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import { WorkspaceMemberEntity } from "./persistence/entities"
import type { AccountDirectory } from "./workspace-members.contracts"
import { ACCOUNT_DIRECTORY } from "./workspace-members.port"
import { WorkspaceMembersService } from "./workspace-members.service"

const rowOf = builder<WorkspaceMemberEntity>({
    id: "member-1",
    workspaceId: "ws-1",
    userId: "user-1",
    role: "staff",
    staffId: null,
    displayName: "An",
    status: "active",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})

/** The statement `callDbFunction` sends for the member pictures. */
const MEMBER_AVATARS = "SELECT * FROM be_access.workspace_member_avatars($1, $2)"

/** A manager-or-staff viewer who lists one member (the viewer) whose picture the avatars door answers. */
const listWorld = (
    viewer: WorkspaceMemberEntity,
    avatars: ReadonlyArray<{ id: string; avatar_url: string | null }>,
) => {
    const em = mockEntityManager({
        findOne: [WorkspaceMemberEntity, viewer],
        query: [MEMBER_AVATARS, avatars],
    })
    const list = fakeQueryBuilder({ getMany: [viewer] })
    em.createQueryBuilder.mockReturnValue(list.builder)
    return { em, list }
}

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

describe("WorkspaceMembersService / ensure", () => {
    const entry = { workspaceId: "ws-1", userId: "target-1", role: "manager", staffId: null, displayName: "Target" }

    it("locks the owner's authority and inserts without overwriting an existing seat", async () => {
        const em = mockEntityManager({
            findOne: [
                [WorkspaceMemberEntity, rowOf({ role: "owner" })],
                [WorkspaceMemberEntity, rowOf({ userId: "target-1", role: "manager" })],
            ],
        })
        const insert = fakeQueryBuilder({ execute: {} })
        em.createQueryBuilder.mockReturnValue(insert.builder)
        const transaction = fakeTransaction(em)
        const { service } = await build(em)
        await expect(service.ensure("user-1", entry)).resolves.toMatchObject({ userId: "target-1", role: "manager" })
        expect(em.findOne.mock.calls).toEqual([
            [
                WorkspaceMemberEntity,
                { where: { workspaceId: "ws-1", userId: "user-1" }, lock: { mode: "pessimistic_write" } },
            ],
            [WorkspaceMemberEntity, { where: { workspaceId: "ws-1", userId: "target-1" } }],
        ])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkspaceMemberEntity, "w")
        expect(insert.callsOf("insert")).toEqual([[]])
        expect(insert.callsOf("values")).toEqual([
            [{ workspaceId: "ws-1", userId: "target-1", role: "manager", staffId: null, displayName: "Target" }],
        ])
        expect(insert.callsOf("orIgnore")).toHaveLength(1)
        expect(transaction.commits).toBe(1)
    })

    it.each([
        { actor: null, code: WorkspaceMembersErrorCode.NotMember },
        { actor: rowOf({ role: "manager" }), code: WorkspaceMembersErrorCode.RoleForbidden },
        { actor: rowOf({ role: "owner", status: "disabled" }), code: WorkspaceMembersErrorCode.NotMember },
    ])("refuses missing or insufficient actor authority before insertion", async ({ actor, code }) => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, actor] }),
            transaction = fakeTransaction(em)
        const { service } = await build(em)
        await expect(service.ensure("user-1", entry)).rejects.toMatchObject({ code })
        expect(transaction.rollbacks).toBe(1)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it.each([
        { target: null },
        { target: rowOf({ role: "staff" }) },
        { target: rowOf({ role: "manager", status: "disabled" }) },
    ])("preserves a conflicting existing seat", async ({ target }) => {
        const em = mockEntityManager({
            findOne: [
                [WorkspaceMemberEntity, rowOf({ role: "owner" })],
                [WorkspaceMemberEntity, target],
            ],
        })
        em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ execute: {} }).builder)
        const transaction = fakeTransaction(em),
            { service } = await build(em)
        await expect(service.ensure("user-1", entry)).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.EnsureConflict,
        })
        expect(transaction.rollbacks).toBe(1)
        expect(em.update).not.toHaveBeenCalled()
    })
})

describe("WorkspaceMembersService / require", () => {
    it("answers the active membership", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, rowOf({ staffId: "staff-1" })] })
        const { service } = await build(em)

        await expect(service.require("user-1", "ws-1")).resolves.toEqual({
            userId: "user-1",
            workspaceId: "ws-1",
            role: "staff",
            staffId: "staff-1",
            displayName: "An",
            status: "active",
        })
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "ws-1", userId: "user-1" },
        })
    })

    it("refuses a person who is not in the workspace", async () => {
        const { service } = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, null] }))

        await expect(service.require("user-1", "ws-9")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.NotMember,
        })
    })

    it("refuses a member whose role is not allowed", async () => {
        const { service } = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, rowOf()] }))

        await expect(service.require("user-1", "ws-1", ["owner", "manager"])).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.RoleForbidden,
        })
    })
})

describe("WorkspaceMembersService / idOf", () => {
    it("answers the member id of the caller's active seat", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, rowOf({ id: "member-1" })] })
        const { service } = await build(em)

        await expect(service.idOf("user-1", "ws-1")).resolves.toBe("member-1")
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            select: { id: true },
            where: { workspaceId: "ws-1", userId: "user-1", status: "active" },
        })
    })

    it("refuses a person with no active seat in the workspace", async () => {
        const { service } = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, null] }))

        await expect(service.idOf("user-1", "ws-9")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.NotMember,
        })
    })
})

describe("WorkspaceMembersService / list", () => {
    it("lists emails and sign-ins for a manager viewer", async () => {
        const { em, list } = listWorld(rowOf({ role: "owner" }), [
            { id: "user-1", avatar_url: "https://cdn.example.test/person.png" },
        ])
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
                avatarUrl: "https://cdn.example.test/person.png",
                email: "an@example.test",
                lastSignInAt: "2026-10-01T00:00:00.000Z",
            },
        ])
        expect(list.callsOf("where")).toEqual([["m.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(list.callsOf("limit")).toEqual([[500]])
        expect(em.query).toHaveBeenCalledWith(MEMBER_AVATARS, ["ws-1", ["user-1"]])
        expect(auth.accountOf).toHaveBeenCalledWith("user-1")
    })

    it("blanks contact details for a staff viewer", async () => {
        const { em } = listWorld(rowOf(), [{ id: "user-1", avatar_url: "https://cdn.example.test/person.png" }])
        const { service, auth } = await build(em)

        await expect(service.list("user-1", "ws-1")).resolves.toMatchObject([
            { avatarUrl: "https://cdn.example.test/person.png", email: "", lastSignInAt: null },
        ])
        expect(auth.accountOf).not.toHaveBeenCalled()
    })

    it("blanks contact details for a member whose account Auth does not know", async () => {
        const { em } = listWorld(rowOf({ role: "manager" }), [])
        const { service, auth } = await build(em)
        auth.accountOf.mockResolvedValue(refused("ACCOUNT_NOT_FOUND"))

        await expect(service.list("user-1", "ws-1")).resolves.toMatchObject([
            { avatarUrl: null, email: "", lastSignInAt: null },
        ])
    })

    it("refuses a caller who is not in the workspace", async () => {
        const { service } = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, null] }))

        await expect(service.list("user-1", "ws-9")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.NotMember,
        })
    })
})

describe("WorkspaceMembersService / join", () => {
    it("creates or reactivates the membership", async () => {
        const em = mockEntityManager()
        const upsert = fakeQueryBuilder({ execute: {} })
        em.createQueryBuilder.mockReturnValue(upsert.builder)
        const { service } = await build(em)

        await service.join({
            workspaceId: "ws-1",
            userId: "user-2",
            role: "staff",
            staffId: "staff-1",
            displayName: "Binh",
        })

        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkspaceMemberEntity, "workspace_members")

        expect(upsert.callsOf("insert")).toEqual([[]])
        expect(upsert.callsOf("values").map(([row]) => resolveFragments(row))).toEqual([
            {
                workspaceId: "ws-1",
                userId: "user-2",
                role: "staff",
                staffId: "staff-1",
                displayName:
                    "coalesce((SELECT s.name FROM public.staff s WHERE s.id = :staffId LIMIT 1), :displayName)",
            },
        ])
        expect(upsert.callsOf("setParameters")).toEqual([[{ staffId: "staff-1", displayName: "Binh" }]])
        expect(upsert.callsOf("onConflict")).toHaveLength(1)
    })

    it("refuses a role the table does not allow before writing", async () => {
        const em = mockEntityManager()
        const upsert = fakeQueryBuilder({ execute: {} })
        em.createQueryBuilder.mockReturnValue(upsert.builder)
        const { service } = await build(em)

        await expect(
            service.join({ workspaceId: "ws-1", userId: "user-2", role: "guest", staffId: null, displayName: "Binh" }),
        ).rejects.toThrow(new TypeError("guest is not a workspace role"))
        expect(upsert.callsOf("execute")).toEqual([])
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
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, rowOf({ role: "manager" })] })
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
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "ws-1", userId: "user-1" },
        })
        expect(staff.save).toHaveBeenCalledWith(input)
    })

    it("refuses staff callers before saving", async () => {
        const { service, staff } = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, rowOf()] }))

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
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, rowOf()] })
        const { service, staff } = await build(em)
        staff.list.mockResolvedValue([saved])

        await expect(service.listStaff("user-1", "ws-1")).resolves.toEqual([option])
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "ws-1", userId: "user-1" },
        })
        expect(staff.list).toHaveBeenCalledWith("ws-1")
    })
})

describe("WorkspaceMembersService", () => {
    it("presents the caller's workspace role", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, rowOf({ role: "owner" })] })
        const { service } = await build(em)

        await expect(service.roleOf("user-1", "ws-1")).resolves.toBe("owner")
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "ws-1", userId: "user-1" },
        })
    })

    it("renames the account in every active workspace with trimmed text", async () => {
        const em = mockEntityManager({ update: [WorkspaceMemberEntity, { affected: 2 }] })
        const { service } = await build(em)

        await expect(service.renameSelf("user-1", "  An Nguyen  ")).resolves.toBeUndefined()
        expect(em.update).toHaveBeenCalledWith(
            WorkspaceMemberEntity,
            { userId: "user-1", status: "active" },
            { displayName: "An Nguyen" },
        )
    })
})

describe("WorkspaceMembersService / seat changes", () => {
    const actor = rowOf({ role: "owner", displayName: "Chu" })
    const target = rowOf({ userId: "user-2", displayName: "Binh" })
    const seats = () =>
        [
            [WorkspaceMemberEntity, actor],
            [WorkspaceMemberEntity, target],
        ] as const
    it("changes a role and records the exact change", async () => {
        const em = mockEntityManager({ findOne: seats(), update: [WorkspaceMemberEntity, { affected: 1 }] })
        const { service, events } = await build(em)

        await expect(service.changeRole("user-1", "ws-1", "user-2", "manager")).resolves.toBeUndefined()
        expect(em.findOne.mock.calls).toEqual([
            [WorkspaceMemberEntity, { where: { workspaceId: "ws-1", userId: "user-1" } }],
            [WorkspaceMemberEntity, { where: { workspaceId: "ws-1", userId: "user-2" } }],
        ])
        expect(em.update).toHaveBeenCalledWith(
            WorkspaceMemberEntity,
            { workspaceId: "ws-1", userId: "user-2" },
            { role: "manager" },
        )
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "member.role_changed",
            actor: "Chu",
            summary: "Binh: staff -> manager",
        })
    })

    it("leaves an identical role unchanged without recording an event", async () => {
        const em = mockEntityManager({ findOne: seats() })
        const { service, events } = await build(em)

        await expect(service.changeRole("user-1", "ws-1", "user-2", "staff")).resolves.toBeUndefined()
        expect(em.findOne).toHaveBeenCalledTimes(2)
        expect(em.update).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it.each([
        ["disabled", "member.disabled"],
        ["active", "member.enabled"],
    ] as const)("sets status %s and records %s", async (status, kind) => {
        const em = mockEntityManager({ findOne: seats(), update: [WorkspaceMemberEntity, { affected: 1 }] })
        const { service, events } = await build(em)

        await expect(service.setStatus("user-1", "ws-1", "user-2", status)).resolves.toBeUndefined()
        expect(em.update).toHaveBeenCalledWith(
            WorkspaceMemberEntity,
            { workspaceId: "ws-1", userId: "user-2" },
            { status },
        )
        expect(events.record).toHaveBeenCalledWith({ workspaceId: "ws-1", kind, actor: "Chu", summary: "Binh" })
    })

    it("removes a member and records their name", async () => {
        const em = mockEntityManager({ findOne: seats(), delete: [WorkspaceMemberEntity, { affected: 1 }] })
        const { service, events } = await build(em)

        await expect(service.remove("user-1", "ws-1", "user-2")).resolves.toBeUndefined()
        expect(em.delete).toHaveBeenCalledWith(WorkspaceMemberEntity, { workspaceId: "ws-1", userId: "user-2" })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "member.removed",
            actor: "Chu",
            summary: "Binh",
        })
    })
})

describe("WorkspaceMembersService / seat changes", () => {
    const actor = rowOf({ role: "owner", displayName: "Chu" })
    const target = rowOf({ userId: "user-2", displayName: "Binh" })
    const seats = () =>
        [
            [WorkspaceMemberEntity, actor],
            [WorkspaceMemberEntity, target],
        ] as const
    it("refuses an absent target before writing or recording an event", async () => {
        const em = mockEntityManager({
            findOne: [
                [WorkspaceMemberEntity, actor],
                [WorkspaceMemberEntity, null],
            ],
        })
        const { service, events } = await build(em)

        await expect(service.remove("user-1", "ws-1", "user-2")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.MemberNotFound,
        })
        expect(em.findOne).toHaveBeenCalledTimes(2)
        expect(events.record).not.toHaveBeenCalled()
    })

    it("refuses removing one's own account before writing", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, actor] })
        const { service, events } = await build(em)

        await expect(service.remove("user-1", "ws-1", "user-1")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.SelfForbidden,
        })
        expect(em.findOne).toHaveBeenCalledTimes(2)
        expect(events.record).not.toHaveBeenCalled()
    })

    it.each([{ affected: 0 }, {}])("refuses when the target disappears before the update: %p", async (written) => {
        const em = mockEntityManager({ findOne: seats(), update: [WorkspaceMemberEntity, written] })
        const { service, events } = await build(em)

        await expect(service.changeRole("user-1", "ws-1", "user-2", "manager")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.MemberNotFound,
        })
        expect(em.update).toHaveBeenCalledWith(
            WorkspaceMemberEntity,
            { workspaceId: "ws-1", userId: "user-2" },
            { role: "manager" },
        )
        expect(events.record).not.toHaveBeenCalled()
    })

    it("translates a last-owner database refusal and preserves its cause", async () => {
        const em = mockEntityManager({ findOne: seats() })
        const cause = new Error("workspace_members guard: last_owner")
        em.delete.mockRejectedValueOnce(cause)
        const { service, events } = await build(em)

        await expect(service.remove("user-1", "ws-1", "user-2")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.LastOwner,
            cause,
        })
        expect(em.delete).toHaveBeenCalledWith(WorkspaceMemberEntity, { workspaceId: "ws-1", userId: "user-2" })
        expect(events.record).not.toHaveBeenCalled()
    })

    it.each([new Error("database offline"), { message: "last_owner" }])(
        "propagates an unrelated database failure unchanged: %p",
        async (cause) => {
            const em = mockEntityManager({ findOne: seats() })
            em.delete.mockRejectedValueOnce(cause)
            const { service, events } = await build(em)

            await expect(service.remove("user-1", "ws-1", "user-2")).rejects.toBe(cause)
            expect(em.delete).toHaveBeenCalledWith(WorkspaceMemberEntity, { workspaceId: "ws-1", userId: "user-2" })
            expect(events.record).not.toHaveBeenCalled()
        },
    )
})
