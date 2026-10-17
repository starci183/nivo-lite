import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { StaffErrorCode } from "./errors/staff.error"
import type { StaffWrite } from "./staff.contracts"
import type { StaffRow } from "./persistence/staff.rows"
import { FIND_STAFF_NAME, INSERT_STAFF, LIST_STAFF, UPDATE_STAFF } from "./persistence/staff.sql"
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
        const em = mockEntityManager({ query: [LIST_STAFF, [row]] })

        await expect((await build(em)).list("ws-1")).resolves.toEqual([row])
        expect(em.query).toHaveBeenCalledWith(LIST_STAFF, ["ws-1"])
    })
})
describe("StaffService nameOf", () => {
    it("finds the name in the selected workspace", async () => {
        const em = mockEntityManager({ query: [FIND_STAFF_NAME, [{ name: "Mai" }]] })

        await expect((await build(em)).nameOf("ws-1", "staff-1")).resolves.toBe("Mai")
        expect(em.query).toHaveBeenCalledWith(FIND_STAFF_NAME, ["ws-1", "staff-1"])
    })

    it("answers null when the staff member is absent", async () => {
        const em = mockEntityManager({ query: [FIND_STAFF_NAME, []] })

        await expect((await build(em)).nameOf("ws-1", "missing")).resolves.toBeNull()
        expect(em.query).toHaveBeenCalledWith(FIND_STAFF_NAME, ["ws-1", "missing"])
    })
})
describe("StaffService save", () => {
    it("inserts collapsed names and roles, trimmed email, and the explicit inactive flag", async () => {
        const row = rowOf({ name: "Mai Lan", role: "sales manager", email: "mai@example.test", active: false })
        const em = mockEntityManager({ query: [INSERT_STAFF, [row]] })

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
        expect(em.query).toHaveBeenCalledWith(INSERT_STAFF, [
            "ws-1",
            "Mai Lan",
            "sales manager",
            "mai@example.test",
            false,
        ])
    })

    it.each([
        { id: undefined, email: undefined, active: undefined },
        { id: null, email: null, active: null },
        { id: null, email: " \t ", active: undefined },
    ])("inserts absent or blank contact data as null: %j", async (input) => {
        const row = rowOf()
        const em = mockEntityManager({ query: [INSERT_STAFF, [row]] })

        await expect((await build(em)).save(writeOf(input))).resolves.toEqual(row)
        expect(em.query).toHaveBeenCalledWith(INSERT_STAFF, ["ws-1", "Mai", "cashier", null, null])
    })

    it("updates the workspace-scoped row and passes the active flag", async () => {
        const row = rowOf({ role: "manager" })
        const em = mockEntityManager({ query: [UPDATE_STAFF, [row]] })

        await expect(
            (await build(em)).save(writeOf({ id: "staff-1", role: " manager ", email: null, active: true })),
        ).resolves.toEqual(row)
        expect(em.query).toHaveBeenCalledWith(UPDATE_STAFF, ["ws-1", "staff-1", "Mai", "manager", null, true])
    })

    it("leaves the stored active flag unchanged when updating without it", async () => {
        const row = rowOf({ active: false })
        const em = mockEntityManager({ query: [UPDATE_STAFF, [row]] })

        await expect((await build(em)).save(writeOf({ id: "staff-1" }))).resolves.toEqual(row)
        expect(em.query).toHaveBeenCalledWith(UPDATE_STAFF, ["ws-1", "staff-1", "Mai", "cashier", null, null])
    })

    it("rejects an empty collapsed name before writing", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).save(writeOf({ name: " \t\n " }))).rejects.toMatchObject({
            code: StaffErrorCode.NameRequired,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("rejects an update that returns no workspace staff row", async () => {
        const em = mockEntityManager({ query: [UPDATE_STAFF, []] })

        await expect((await build(em)).save(writeOf({ id: "missing" }))).rejects.toMatchObject({
            code: StaffErrorCode.NotFound,
        })
        expect(em.query).toHaveBeenCalledWith(UPDATE_STAFF, ["ws-1", "missing", "Mai", "cashier", null, null])
    })
})
