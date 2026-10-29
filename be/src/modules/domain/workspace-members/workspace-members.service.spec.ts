import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { writeExpressionOf } from "@tests/fixtures/builders/write-expression.builder"
import {
    accountOf,
    CHU_OWNER_SEAT,
    joinWorld,
    listWorld,
    MEMBER_AVATARS,
    SAVED_STAFF,
    seatChangeReads,
    seatLookup,
    seatRowOf,
    STAFF_OPTION,
} from "@tests/fixtures/builders/workspace-members.builder"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EventsService } from "@modules/domain/events"
import { StaffDirectoryService, StaffService } from "@modules/domain/staff"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import { WorkspaceMemberEntity } from "./persistence/entities"
import type { AccountDirectory } from "./workspace-members.contracts"
import { ACCOUNT_DIRECTORY } from "./workspace-members.port"
import { WorkspaceMembersService } from "./workspace-members.service"

const build = async (entityManager: MockEntityManager) => {
    const auth = mock<AccountDirectory>()
    const events = mock<EventsService>()
    const staff = mock<StaffService>()
    const staffNames = mock<StaffDirectoryService>()
    staffNames.namesOf.mockResolvedValue([])
    events.record.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceMembersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ACCOUNT_DIRECTORY, useValue: auth },
            { provide: EventsService, useValue: events },
            { provide: StaffService, useValue: staff },
            { provide: StaffDirectoryService, useValue: staffNames },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceMembersService), auth, events, staff, staffNames }
}

describe("WorkspaceMembersService / ensure", () => {
    const entry = { workspaceId: "ws-1", userId: "target-1", role: "manager", staffId: null, displayName: "Target" }

    it("locks the owner's authority and inserts without overwriting an existing seat", async () => {
        const em = mockEntityManager({
            findOne: [
                [WorkspaceMemberEntity, seatRowOf("owner")],
                [WorkspaceMemberEntity, seatRowOf("manager", "active", "target-1")],
            ],
        })
        const insert = fakeQueryBuilder({ execute: {} })
        em.createQueryBuilder.mockReturnValue(insert.builder)
        const transaction = fakeTransaction(em)
        const { service } = await build(em)
        await expect(service.ensure("user-1", entry)).resolves.toMatchObject({ userId: "target-1", role: "manager" })
        expect(em.findOne.mock.calls).toEqual([
            [WorkspaceMemberEntity, { ...seatLookup("ws-1", "user-1"), lock: { mode: "pessimistic_write" } }],
            [WorkspaceMemberEntity, seatLookup("ws-1", "target-1")],
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
        { actor: seatRowOf("manager"), code: WorkspaceMembersErrorCode.RoleForbidden },
        { actor: seatRowOf("owner", "disabled"), code: WorkspaceMembersErrorCode.NotMember },
    ])("refuses missing or insufficient actor authority before insertion", async ({ actor, code }) => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, actor] }),
            transaction = fakeTransaction(em)
        const { service } = await build(em)
        await expect(service.ensure("user-1", entry)).rejects.toMatchObject({ code })
        expect(transaction.rollbacks).toBe(1)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it.each([{ target: null }, { target: seatRowOf("staff") }, { target: seatRowOf("manager", "disabled") }])(
        "preserves a conflicting existing seat",
        async ({ target }) => {
            const em = mockEntityManager({
                findOne: [
                    [WorkspaceMemberEntity, seatRowOf("owner")],
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
        },
    )
})

describe("WorkspaceMembersService / require", () => {
    it("answers the active membership", async () => {
        const em = mockEntityManager({
            findOne: [WorkspaceMemberEntity, seatRowOf("staff", "active", "user-1", "An", "staff-1")],
        })
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

    it.each([
        { seat: null, roles: undefined, code: WorkspaceMembersErrorCode.NotMember },
        { seat: seatRowOf(), roles: ["owner", "manager"] as const, code: WorkspaceMembersErrorCode.RoleForbidden },
    ])("refuses a person outside the workspace or outside the allowed roles: $code", async ({ seat, roles, code }) => {
        const { service } = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, seat] }))

        await expect(service.require("user-1", "ws-1", roles)).rejects.toMatchObject({ code })
    })
})

describe("WorkspaceMembersService / idOf", () => {
    it("answers the member id of the caller's active seat", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, seatRowOf()] })
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
        const { em, list } = listWorld(WorkspaceMemberEntity, seatRowOf("owner"), [
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
        const { em } = listWorld(WorkspaceMemberEntity, seatRowOf(), [
            { id: "user-1", avatar_url: "https://cdn.example.test/person.png" },
        ])
        const { service, auth } = await build(em)

        await expect(service.list("user-1", "ws-1")).resolves.toMatchObject([
            { avatarUrl: "https://cdn.example.test/person.png", email: "", lastSignInAt: null },
        ])
        expect(auth.accountOf).not.toHaveBeenCalled()
    })

    it("blanks contact details for a member whose account Auth does not know", async () => {
        const { em } = listWorld(WorkspaceMemberEntity, seatRowOf("manager"), [])
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
    const entry = { workspaceId: "ws-1", userId: "user-2", role: "staff", staffId: "staff-1", displayName: "Binh" }
    const buildJoin = async () => {
        const world = joinWorld()
        return { ...(await build(world.em)), ...world }
    }

    it("creates the membership under the name of the staff row it links, then reactivates it keeping owner and link", async () => {
        const { service, staffNames, em, insert, update, transaction } = await buildJoin()
        staffNames.namesOf.mockResolvedValue([{ id: "staff-1", name: "Binh Tran" }])

        await service.join(entry)

        expect(staffNames.namesOf).toHaveBeenCalledWith("ws-1", ["staff-1"])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkspaceMemberEntity, "workspace_members")
        expect(insert.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    userId: "user-2",
                    role: "staff",
                    staffId: "staff-1",
                    displayName: "Binh Tran",
                },
            ],
        ])
        expect(insert.callsOf("orIgnore")).toHaveLength(1)
        const written = update.callsOf("set")[0]?.[0]
        expect(writeExpressionOf(written, "role")).toBe("CASE WHEN role = 'owner' THEN 'owner' ELSE :role END")
        expect(writeExpressionOf(written, "staffId")).toBe("coalesce(:staffId, staff_id)")
        expect(update.callsOf("setParameters")).toEqual([[{ role: "staff", staffId: "staff-1" }]])
        expect(transaction.commits).toBe(1)
    })

    it("keeps the given name when the linked staff row is not found", async () => {
        const { service, insert } = await buildJoin()

        await service.join(entry)

        expect(insert.callsOf("values")).toEqual([[expect.objectContaining({ displayName: "Binh" })]])
    })

    it("refuses a role the table does not allow", async () => {
        const { service, insert } = await buildJoin()

        await expect(service.join({ ...entry, role: "admin" })).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.RoleInvalid,
        })
        expect(insert.calls).toEqual([])
    })

    it("asks for no staff name when the seat links no staff row", async () => {
        const { service, staffNames, insert } = await buildJoin()

        await service.join({ ...entry, staffId: null })

        expect(staffNames.namesOf).not.toHaveBeenCalled()
        expect(insert.callsOf("values")).toEqual([[expect.objectContaining({ staffId: null, displayName: "Binh" })]])
    })
})

describe("WorkspaceMembersService / staff directory", () => {
    it("saves staff after proving the caller is a manager and returns the console fields", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, seatRowOf("manager")] })
        const { service, staff } = await build(em)
        staff.save.mockResolvedValue(SAVED_STAFF)
        const input = {
            workspaceId: "ws-1",
            id: "staff-2",
            name: "Binh",
            role: "Sales",
            email: "binh@example.test",
            active: false,
        }

        await expect(service.saveStaff("user-1", input)).resolves.toEqual(STAFF_OPTION)
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "ws-1", userId: "user-1" },
        })
        expect(staff.save).toHaveBeenCalledWith(input)
    })

    it("refuses staff callers before saving", async () => {
        const { service, staff } = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, seatRowOf()] }))

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
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, seatRowOf()] })
        const { service, staff } = await build(em)
        staff.list.mockResolvedValue([SAVED_STAFF])

        await expect(service.listStaff("user-1", "ws-1")).resolves.toEqual([STAFF_OPTION])
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "ws-1", userId: "user-1" },
        })
        expect(staff.list).toHaveBeenCalledWith("ws-1")
    })
})

describe("WorkspaceMembersService", () => {
    it("presents the caller's workspace role", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, seatRowOf("owner")] })
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
    it("changes a role and records the exact change", async () => {
        const em = mockEntityManager({
            findOne: seatChangeReads(WorkspaceMemberEntity),
            update: [WorkspaceMemberEntity, { affected: 1 }],
        })
        const { service, events } = await build(em)

        await expect(service.changeRole("user-1", "ws-1", "user-2", "manager")).resolves.toBeUndefined()
        expect(em.findOne.mock.calls).toEqual([
            [WorkspaceMemberEntity, seatLookup("ws-1", "user-1")],
            [WorkspaceMemberEntity, seatLookup("ws-1", "user-2")],
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
        const em = mockEntityManager({ findOne: seatChangeReads(WorkspaceMemberEntity) })
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
        const em = mockEntityManager({
            findOne: seatChangeReads(WorkspaceMemberEntity),
            update: [WorkspaceMemberEntity, { affected: 1 }],
        })
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
        const em = mockEntityManager({
            findOne: seatChangeReads(WorkspaceMemberEntity),
            delete: [WorkspaceMemberEntity, { affected: 1 }],
        })
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
    it("refuses an absent target before writing or recording an event", async () => {
        const em = mockEntityManager({
            findOne: [
                [WorkspaceMemberEntity, CHU_OWNER_SEAT],
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
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, CHU_OWNER_SEAT] })
        const { service, events } = await build(em)

        await expect(service.remove("user-1", "ws-1", "user-1")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.SelfForbidden,
        })
        expect(em.findOne).toHaveBeenCalledTimes(2)
        expect(events.record).not.toHaveBeenCalled()
    })

    it.each([{ affected: 0 }, {}])("refuses when the target disappears before the update: %p", async (written) => {
        const em = mockEntityManager({
            findOne: seatChangeReads(WorkspaceMemberEntity),
            update: [WorkspaceMemberEntity, written],
        })
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
        const em = mockEntityManager({ findOne: seatChangeReads(WorkspaceMemberEntity) })
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
            const em = mockEntityManager({ findOne: seatChangeReads(WorkspaceMemberEntity) })
            em.delete.mockRejectedValueOnce(cause)
            const { service, events } = await build(em)

            await expect(service.remove("user-1", "ws-1", "user-2")).rejects.toBe(cause)
            expect(em.delete).toHaveBeenCalledWith(WorkspaceMemberEntity, { workspaceId: "ws-1", userId: "user-2" })
            expect(events.record).not.toHaveBeenCalled()
        },
    )
})
