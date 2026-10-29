import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import type { WorkspacesOptions } from "./workspaces.options"
import { WORKSPACES_OPTIONS } from "./workspaces.port"
import { WorkspacesService } from "./workspaces.service"
import { FIRST_WORKSPACE_NAME } from "./workspaces.templates"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

/** One membership row as the join selects it. */
interface MembershipRaw {
    workspace_id: string
    user_id: string
    role: "owner" | "manager" | "staff"
    staff_id: string | null
    display_name: string
    status: "active" | "disabled"
    workspace_name: string
    workspace_status: string
    owner_id: string
    workspace_created_at: Date
    business_type: string | null
}

const rowOf = builder<MembershipRaw>({
    workspace_id: "ws-1",
    user_id: "user-1",
    role: "manager",
    staff_id: null,
    display_name: "An",
    status: "active",
    workspace_name: "Quan Ca Phe",
    workspace_status: "active",
    owner_id: "owner-1",
    workspace_created_at: new Date("2026-10-01T00:00:00.000Z"),
    business_type: "cafe",
})

const LOCK_FIRST_WORKSPACE = "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))"

const INSERTED = (id: string) => ({ identifiers: [{ id }], generatedMaps: [], raw: [] })

const build = async (entityManager: MockEntityManager, overrides: Partial<WorkspacesOptions> = {}) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspacesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            {
                provide: WORKSPACES_OPTIONS,
                useValue: builder<WorkspacesOptions>({ allowFreeWorkspace: false })(overrides),
            },
        ],
    }).compile()
    return moduleRef.get(WorkspacesService)
}

/** A manager whose query builders answer `answers` and that takes the creation lock. */
const managerAnswering = (answers: QueryBuilderAnswers) => {
    const fake = fakeQueryBuilder(answers)
    const em = mockEntityManager({ query: [LOCK_FIRST_WORKSPACE, []] })
    em.createQueryBuilder.mockReturnValue(fake.builder as never)
    return { em, fake }
}

describe("WorkspacesService", () => {
    describe("ensureNamed", () => {
        it("keeps the exact owned name even when new signup is disabled", async () => {
            const { em, fake } = managerAnswering({ getRawMany: [{ id: "ws-1", active: true }] })
            const transaction = fakeTransaction(em)
            await expect((await build(em)).ensureNamed("owner-1", "Explicit")).resolves.toEqual({ id: "ws-1" })
            expect(em.query).toHaveBeenCalledWith(LOCK_FIRST_WORKSPACE, ["workspace-first:owner-1"])
            expect(fake.callsOf("where")).toEqual([
                ["w.owner_id = :userId AND w.name = :name", { userId: "owner-1", name: "Explicit" }],
            ])
            expect(fake.callsOf("limit")).toEqual([[2]])
            expect(transaction.commits).toBe(1)
        })

        it("creates only after the serialized exact-name lookup found none", async () => {
            const { em } = managerAnswering({ getRawMany: [] })
            em.insert.mockResolvedValue(INSERTED("ws-new") as never)
            const transaction = fakeTransaction(em)
            await expect(
                (await build(em, { allowFreeWorkspace: true })).ensureNamed("owner-1", "Explicit"),
            ).resolves.toEqual({ id: "ws-new" })
            expect(em.insert).toHaveBeenCalledWith(WorkspaceEntity, {
                ownerId: "owner-1",
                name: "Explicit",
                status: "active",
            })
            expect(transaction.commits).toBe(1)
        })

        it.each([
            {
                rows: [
                    { id: "ws-1", active: true },
                    { id: "ws-2", active: true },
                ],
                code: WorkspacesErrorCode.NameAmbiguous,
            },
            { rows: [{ id: "ws-1", active: false }], code: WorkspacesErrorCode.NameUnavailable },
            { rows: [], code: WorkspacesErrorCode.SignupDisabled },
        ])("refuses a non-unique or unavailable selector without creating", async ({ rows, code }) => {
            const { em } = managerAnswering({ getRawMany: rows })
            const transaction = fakeTransaction(em)
            await expect((await build(em)).ensureNamed("owner-1", "Explicit")).rejects.toMatchObject({ code })
            expect(transaction.rollbacks).toBe(1)
            expect(em.insert).not.toHaveBeenCalled()
        })

        it.each([" ", "x".repeat(121)])("refuses an invalid exact name before opening a transaction", async (name) => {
            const em = mockEntityManager(),
                service = await build(em)
            expect(thrownBy(() => service.ensureNamed("owner-1", name))).toEqual(
                objectLike({ code: WorkspacesErrorCode.NameInvalid }),
            )
            expect(em.transaction).not.toHaveBeenCalled()
        })
    })
})

describe("WorkspacesService", () => {
    describe("nameOf", () => {
        it("answers the stored workspace name", async () => {
            const em = mockEntityManager({
                findOne: [WorkspaceEntity, Object.assign(new WorkspaceEntity(), { name: "Quan Ca Phe" })],
            })

            await expect((await build(em)).nameOf("ws-1")).resolves.toBe("Quan Ca Phe")
            expect(em.findOne).toHaveBeenCalledWith(WorkspaceEntity, { select: { name: true }, where: { id: "ws-1" } })
        })

        it("answers empty text for a missing workspace", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceEntity, null] })

            await expect((await build(em)).nameOf("ws-missing")).resolves.toBe("")
        })
    })
})

describe("WorkspacesService", () => {
    describe("memberships", () => {
        it("maps each membership with its workspace, oldest first and bounded", async () => {
            const read = fakeQueryBuilder({ getRawMany: [rowOf()] })
            const em = mockEntityManager()
            em.createQueryBuilder.mockReturnValue(read.builder as never)

            await expect((await build(em)).memberships("user-1")).resolves.toEqual([
                {
                    member: {
                        userId: "user-1",
                        workspaceId: "ws-1",
                        role: "manager",
                        staffId: null,
                        displayName: "An",
                        status: "active",
                    },
                    workspace: {
                        id: "ws-1",
                        name: "Quan Ca Phe",
                        status: "active",
                        ownerId: "owner-1",
                        createdAt: "2026-10-01T00:00:00.000Z",
                        businessType: "cafe",
                    },
                },
            ])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkspaceEntity, "w")
            expect(read.callsOf("innerJoin")).toEqual([["workspace_members", "m", "m.workspace_id = w.id"]])
            expect(read.callsOf("where")).toEqual([["m.user_id = :userId", { userId: "user-1" }]])
            expect(read.callsOf("orderBy")).toEqual([["m.created_at", "ASC"]])
            expect(read.callsOf("addOrderBy")).toEqual([["m.id", "ASC"]])
            expect(read.callsOf("limit")).toEqual([[500]])
        })
    })
})

describe("WorkspacesService", () => {
    describe("createFree", () => {
        it("creates an active workspace owned by the person where signup is allowed", async () => {
            const em = mockEntityManager({ insert: [WorkspaceEntity, INSERTED("ws-new")] })
            const service = await build(em, { allowFreeWorkspace: true })

            await expect(service.createFree("user-1", "NIVO Workspace")).resolves.toEqual({ id: "ws-new" })
            expect(em.insert).toHaveBeenCalledWith(WorkspaceEntity, {
                ownerId: "user-1",
                name: "NIVO Workspace",
                status: "active",
            })
        })

        it("refuses where signup is switched off", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).createFree("user-1", "NIVO Workspace")).rejects.toMatchObject({
                code: WorkspacesErrorCode.SignupDisabled,
            })
            expect(em.insert).not.toHaveBeenCalled()
        })
    })
})

describe("WorkspacesService", () => {
    describe("setBrand", () => {
        const brand = { displayName: "Brand Name", logoUrl: "/brand/logo.jpg" }

        it("writes the brand only where the workspace is owned by the caller", async () => {
            const em = mockEntityManager({ update: [WorkspaceEntity, { affected: 1, raw: [], generatedMaps: [] }] })

            await expect((await build(em)).setBrand("owner-1", "ws-1", brand)).resolves.toBeUndefined()
            expect(em.update).toHaveBeenCalledWith(
                WorkspaceEntity,
                { id: "ws-1", ownerId: "owner-1" },
                { displayName: "Brand Name", logoUrl: "/brand/logo.jpg" },
            )
        })

        it("refuses as not found when the driver reports no affected rows", async () => {
            const em = mockEntityManager({ update: [WorkspaceEntity, { raw: [], generatedMaps: [] }] })

            await expect((await build(em)).setBrand("stranger", "ws-1", brand)).rejects.toMatchObject({
                code: WorkspacesErrorCode.NotFound,
            })
        })

        it("refuses as not found when no owned workspace matched", async () => {
            const em = mockEntityManager({ update: [WorkspaceEntity, { affected: 0, raw: [], generatedMaps: [] }] })

            await expect((await build(em)).setBrand("stranger", "ws-1", brand)).rejects.toMatchObject({
                code: WorkspacesErrorCode.NotFound,
            })
        })
    })
})

describe("WorkspacesService", () => {
    describe("startFirst", () => {
        it("creates nothing where free signup is disabled", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).startFirst("user-1")).resolves.toEqual({ id: null })
            expect(em.transaction).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })

        it("locks the person first load and keeps their existing membership", async () => {
            const { em, fake } = managerAnswering({ getRawOne: { held: 1 } })
            const transaction = fakeTransaction(em)
            const service = await build(em, { allowFreeWorkspace: true })

            await expect(service.startFirst("user-1")).resolves.toEqual({ id: null })
            expect(em.query.mock.calls).toEqual([[LOCK_FIRST_WORKSPACE, ["workspace-first:user-1"]]])
            expect(fake.callsOf("from")).toEqual([["workspace_members", "m"]])
            expect(fake.callsOf("where")).toEqual([["m.user_id = :userId", { userId: "user-1" }]])
            expect(em.insert).not.toHaveBeenCalled()
            expect(transaction.commits).toBe(1)
            expect(transaction.committedWrites).toEqual([])
        })

        it("keeps the workspace the person owns without a membership", async () => {
            const { em } = managerAnswering({ getRawOne: undefined })
            em.exists.mockResolvedValue(true)
            const transaction = fakeTransaction(em)
            const service = await build(em, { allowFreeWorkspace: true })

            await expect(service.startFirst("user-1")).resolves.toEqual({ id: null })
            expect(em.exists).toHaveBeenCalledWith(WorkspaceEntity, { where: { ownerId: "user-1" } })
            expect(em.insert).not.toHaveBeenCalled()
            expect(transaction.commits).toBe(1)
        })

        it("refuses as not found when the insert answers no id", async () => {
            const { em } = managerAnswering({ getRawOne: undefined })
            em.exists.mockResolvedValue(false)
            em.insert.mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] } as never)
            fakeTransaction(em)
            const service = await build(em, { allowFreeWorkspace: true })

            await expect(service.startFirst("user-1")).rejects.toMatchObject({ code: WorkspacesErrorCode.NotFound })
        })

        it("creates the first workspace when the person holds none", async () => {
            const { em } = managerAnswering({ getRawOne: undefined })
            em.exists.mockResolvedValue(false)
            em.insert.mockResolvedValue(INSERTED("ws-first") as never)
            const transaction = fakeTransaction(em)
            const service = await build(em, { allowFreeWorkspace: true })

            await expect(service.startFirst("user-1")).resolves.toEqual({ id: "ws-first" })
            expect(em.query.mock.calls).toEqual([[LOCK_FIRST_WORKSPACE, ["workspace-first:user-1"]]])
            expect(em.insert).toHaveBeenCalledWith(WorkspaceEntity, {
                ownerId: "user-1",
                name: FIRST_WORKSPACE_NAME,
                status: "active",
            })
            expect(transaction.commits).toBe(1)
            expect(transaction.rollbacks).toBe(0)
            expect(em.transaction).toHaveBeenCalledTimes(1)
        })
    })
})
