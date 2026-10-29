import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { StaffErrorCode } from "./errors/staff.error"
import type { StaffRow, StaffWrite } from "./staff.contracts"
import { StaffEntity } from "./persistence/entities"
import { StaffService } from "./staff.service"

const rowOf = builder<StaffRow>({
    id: "staff-1",
    workspace_id: "ws-1",
    name: "Mai",
    role: "cashier",
    email: null,
    active: true,
    created_at: "2026-10-01T00:00:00.000Z",
})

const entityOf = (row: StaffRow): StaffEntity =>
    Object.assign(new StaffEntity(), {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        role: row.role,
        email: row.email,
        active: row.active,
        createdAt: new Date(row.created_at),
    })

const writeOf = builder<StaffWrite>({
    workspaceId: "ws-1",
    id: undefined,
    name: "Mai",
    role: "cashier",
    email: undefined,
    active: undefined,
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [StaffService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(StaffService)
}

describe("StaffService list", () => {
    it("lists the staff of the workspace", async () => {
        const row = rowOf({ email: "mai@example.test", active: false })
        const em = mockEntityManager({ find: [StaffEntity, [entityOf(row)]] })

        await expect((await build(em)).list("ws-1")).resolves.toEqual([row])
        expect(em.find).toHaveBeenCalledWith(StaffEntity, {
            where: { workspaceId: "ws-1" },
            order: { active: "DESC", createdAt: "ASC", id: "ASC" },
            take: 500,
        })
    })
})

describe("StaffService nameOf", () => {
    it("finds the name in the selected workspace", async () => {
        const em = mockEntityManager({ findOne: [StaffEntity, entityOf(rowOf())] })

        await expect((await build(em)).nameOf("ws-1", "staff-1")).resolves.toBe("Mai")
        expect(em.findOne).toHaveBeenCalledWith(StaffEntity, {
            select: { name: true },
            where: { workspaceId: "ws-1", id: "staff-1" },
        })
    })

    it("answers null when the staff member is absent", async () => {
        const em = mockEntityManager({ findOne: [StaffEntity, null] })

        await expect((await build(em)).nameOf("ws-1", "missing")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(StaffEntity, {
            select: { name: true },
            where: { workspaceId: "ws-1", id: "missing" },
        })
    })
})

describe("StaffService save", () => {
    it("inserts collapsed names and roles, trimmed email, and the explicit inactive flag", async () => {
        const row = rowOf({ name: "Mai Lan", role: "sales manager", email: "mai@example.test", active: false })
        const em = mockEntityManager({ save: [StaffEntity, entityOf(row)] })

        await expect(
            (await build(em)).save(
                writeOf({
                    name: "  Mai \t Lan  ",
                    role: " sales\n manager ",
                    email: " mai@example.test ",
                    active: false,
                }),
            ),
        ).resolves.toEqual(row)
        expect(em.save).toHaveBeenCalledWith(
            StaffEntity,
            expect.objectContaining({
                workspaceId: "ws-1",
                name: "Mai Lan",
                role: "sales manager",
                email: "mai@example.test",
                active: false,
            }),
        )
    })

    it.each([
        { id: undefined, email: undefined, active: undefined },
        { id: null, email: null, active: null },
        { id: null, email: " \t ", active: undefined },
    ])("inserts absent or blank contact data as null and active by default: %j", async (input) => {
        const row = rowOf()
        const em = mockEntityManager({ save: [StaffEntity, entityOf(row)] })

        await expect((await build(em)).save(writeOf(input))).resolves.toEqual(row)
        expect(em.save).toHaveBeenCalledWith(
            StaffEntity,
            expect.objectContaining({ workspaceId: "ws-1", name: "Mai", role: "cashier", email: null, active: true }),
        )
    })
})

describe("StaffService save, updating", () => {
    it("updates the workspace-scoped row and passes the active flag", async () => {
        const row = rowOf({ role: "manager" })
        const em = mockEntityManager({
            update: [StaffEntity, { affected: 1 }],
            findOneBy: [StaffEntity, entityOf(row)],
        })

        await expect(
            (await build(em)).save(writeOf({ id: "staff-1", role: " manager ", email: null, active: true })),
        ).resolves.toEqual(row)
        expect(em.update).toHaveBeenCalledWith(
            StaffEntity,
            { workspaceId: "ws-1", id: "staff-1" },
            { name: "Mai", role: "manager", email: null, active: true },
        )
    })

    it("leaves the stored active flag unchanged when updating without it", async () => {
        const row = rowOf({ active: false })
        const em = mockEntityManager({
            update: [StaffEntity, { affected: 1 }],
            findOneBy: [StaffEntity, entityOf(row)],
        })

        await expect((await build(em)).save(writeOf({ id: "staff-1" }))).resolves.toEqual(row)
        expect(em.update).toHaveBeenCalledWith(
            StaffEntity,
            { workspaceId: "ws-1", id: "staff-1" },
            { name: "Mai", role: "cashier", email: null },
        )
    })

    it("rejects an empty collapsed name before writing", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).save(writeOf({ name: " \t\n " }))).rejects.toMatchObject({
            code: StaffErrorCode.NameRequired,
        })
        expect(em.save).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })

    it("rejects an update that touches no workspace staff row", async () => {
        const em = mockEntityManager({ update: [StaffEntity, { affected: 0 }] })

        await expect((await build(em)).save(writeOf({ id: "missing" }))).rejects.toMatchObject({
            code: StaffErrorCode.NotFound,
        })
        expect(em.update).toHaveBeenCalledWith(
            StaffEntity,
            { workspaceId: "ws-1", id: "missing" },
            { name: "Mai", role: "cashier", email: null },
        )
        expect(em.findOneBy).not.toHaveBeenCalled()
    })
})
