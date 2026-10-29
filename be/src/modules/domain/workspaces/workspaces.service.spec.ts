import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
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

/** A seat of the caller, as the workspace-members directory answers it. */
const seatOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: null,
    displayName: "An",
    status: "active",
})

/** A workspace row as the memberships read finds it. */
const workspaceOf = entityOf(WorkspaceEntity, {
    id: "ws-1",
    name: "Quan Ca Phe",
    status: "active",
    ownerId: "owner-1",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    businessType: "cafe",
})

const LOCK_FIRST_WORKSPACE = "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))"

const INSERTED = (id: string) => ({ identifiers: [{ id }], generatedMaps: [], raw: [] })

const build = async (
    entityManager: MockEntityManager,
    overrides: Partial<WorkspacesOptions> = {},
    members: WorkspaceMemberDirectoryService = mock<WorkspaceMemberDirectoryService>(),
) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspacesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMemberDirectoryService, useValue: members },
            {
                provide: WORKSPACES_OPTIONS,
                useValue: builder<WorkspacesOptions>({ allowFreeWorkspace: false })(overrides),
            },
        ],
    }).compile()
    return moduleRef.get(WorkspacesService)
}

/** A manager that takes the creation lock and finds `owned` as the workspaces of that exact name. */
const managerFinding = (owned: Array<Partial<WorkspaceEntity>>) =>
    mockEntityManager({
        query: [LOCK_FIRST_WORKSPACE, []],
        find: [WorkspaceEntity, owned.map((row) => workspaceOf(row))],
    })

describe("WorkspacesService", () => {
    describe("ensureNamed", () => {
        it("keeps the exact owned name even when new signup is disabled", async () => {
            const em = managerFinding([{ id: "ws-1" }])
            const members = mock<WorkspaceMemberDirectoryService>()
            members.isActiveOwner.mockResolvedValue(true)
            const transaction = fakeTransaction(em)
            await expect((await build(em, {}, members)).ensureNamed("owner-1", "Explicit")).resolves.toEqual({
                id: "ws-1",
            })
            expect(em.query).toHaveBeenCalledWith(LOCK_FIRST_WORKSPACE, ["workspace-first:owner-1"])
            expect(em.find).toHaveBeenCalledWith(WorkspaceEntity, {
                select: { id: true, status: true },
                where: { ownerId: "owner-1", name: "Explicit" },
                take: 2,
            })
            expect(members.isActiveOwner).toHaveBeenCalledWith("ws-1", "owner-1", expect.anything())
            expect(transaction.commits).toBe(1)
        })

        it("creates only after the serialized exact-name lookup found none", async () => {
            const em = managerFinding([])
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
                owned: [{ id: "ws-1" }, { id: "ws-2" }],
                owner: true,
                code: WorkspacesErrorCode.NameAmbiguous,
            },
            { owned: [{ id: "ws-1" }], owner: false, code: WorkspacesErrorCode.NameUnavailable },
            {
                owned: [{ id: "ws-1", status: "past_due" as const }],
                owner: true,
                code: WorkspacesErrorCode.NameUnavailable,
            },
            { owned: [], owner: true, code: WorkspacesErrorCode.SignupDisabled },
        ])("refuses a non-unique or unavailable selector without creating", async ({ owned, owner, code }) => {
            const em = managerFinding(owned)
            const members = mock<WorkspaceMemberDirectoryService>()
            members.isActiveOwner.mockResolvedValue(owner)
            const transaction = fakeTransaction(em)
            await expect((await build(em, {}, members)).ensureNamed("owner-1", "Explicit")).rejects.toMatchObject({
                code,
            })
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
        it("maps each seat of the person with its workspace, in the order of the seats", async () => {
            const members = mock<WorkspaceMemberDirectoryService>()
            members.seatsOf.mockResolvedValue([seatOf(), seatOf({ workspaceId: "ws-gone" })])
            const em = mockEntityManager({ find: [WorkspaceEntity, [workspaceOf()]] })

            await expect((await build(em, {}, members)).memberships("user-1")).resolves.toEqual([
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
            expect(members.seatsOf).toHaveBeenCalledWith("user-1", 500)
            expect(em.find).toHaveBeenCalledWith(WorkspaceEntity, {
                where: { id: In(["ws-1", "ws-gone"]) },
                take: 2,
            })
        })

        it("reads no workspace for a person without a seat", async () => {
            const members = mock<WorkspaceMemberDirectoryService>()
            members.seatsOf.mockResolvedValue([])
            const em = mockEntityManager()

            await expect((await build(em, {}, members)).memberships("user-9")).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })
    })

    describe("list", () => {
        it("lists the workspaces by id, bounded", async () => {
            const em = mockEntityManager({ find: [WorkspaceEntity, [workspaceOf()]] })

            await expect((await build(em)).list(10)).resolves.toEqual([{ id: "ws-1", name: "Quan Ca Phe" }])
            expect(em.find).toHaveBeenCalledWith(WorkspaceEntity, {
                select: { id: true, name: true },
                order: { id: "ASC" },
                take: 10,
            })
        })
    })

    describe("ownerIdsOf", () => {
        it("asks for nothing when no workspace is given", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).ownerIdsOf([], 5)).resolves.toEqual([])
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("lists each owner once, in id order, bounded", async () => {
            const read = fakeQueryBuilder({ getRawMany: [{ owner_id: "owner-1" }] })
            const em = mockEntityManager()
            em.createQueryBuilder.mockReturnValue(read.builder as never)

            await expect((await build(em)).ownerIdsOf(["ws-1"], 5)).resolves.toEqual(["owner-1"])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkspaceEntity, "w")
            expect(read.callsOf("distinct")).toEqual([[true]])
            expect(read.callsOf("where")).toEqual([["w.id IN (:...workspaceIds)", { workspaceIds: ["ws-1"] }]])
            expect(read.callsOf("orderBy")).toEqual([["w.ownerId"]])
            expect(read.callsOf("limit")).toEqual([[5]])
        })
    })

    describe("ownerIdOf", () => {
        it("answers the owner of the workspace", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceEntity, workspaceOf()] })

            await expect((await build(em)).ownerIdOf("ws-1")).resolves.toBe("owner-1")
            expect(em.findOne).toHaveBeenCalledWith(WorkspaceEntity, {
                select: { ownerId: true },
                where: { id: "ws-1" },
            })
        })

        it("answers none for a missing workspace", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceEntity, null] })

            await expect((await build(em)).ownerIdOf("ws-9")).resolves.toBeNull()
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

        it("refuses as not found when the insert answers no identifier", async () => {
            const em = mockEntityManager({ insert: [WorkspaceEntity, { identifiers: [], generatedMaps: [], raw: [] }] })

            await expect(
                (await build(em, { allowFreeWorkspace: true })).createFree("user-1", "NIVO Workspace"),
            ).rejects.toMatchObject({ code: WorkspacesErrorCode.NotFound })
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

        it("refuses as not found when the update does not report a count", async () => {
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
            const em = mockEntityManager({ query: [LOCK_FIRST_WORKSPACE, []] })
            const members = mock<WorkspaceMemberDirectoryService>()
            members.holdsAny.mockResolvedValue(true)
            const transaction = fakeTransaction(em)
            const service = await build(em, { allowFreeWorkspace: true }, members)

            await expect(service.startFirst("user-1")).resolves.toEqual({ id: null })
            expect(em.query.mock.calls).toEqual([[LOCK_FIRST_WORKSPACE, ["workspace-first:user-1"]]])
            expect(members.holdsAny).toHaveBeenCalledWith("user-1", expect.anything())
            expect(em.insert).not.toHaveBeenCalled()
            expect(transaction.commits).toBe(1)
            expect(transaction.committedWrites).toEqual([])
        })

        it("keeps the workspace the person owns without a membership", async () => {
            const em = mockEntityManager({ query: [LOCK_FIRST_WORKSPACE, []] })
            em.exists.mockResolvedValue(true)
            const members = mock<WorkspaceMemberDirectoryService>()
            members.holdsAny.mockResolvedValue(false)
            const transaction = fakeTransaction(em)
            const service = await build(em, { allowFreeWorkspace: true }, members)

            await expect(service.startFirst("user-1")).resolves.toEqual({ id: null })
            expect(em.exists).toHaveBeenCalledWith(WorkspaceEntity, { where: { ownerId: "user-1" } })
            expect(em.insert).not.toHaveBeenCalled()
            expect(transaction.commits).toBe(1)
        })

        it("creates the first workspace when the person holds none", async () => {
            const em = mockEntityManager({ query: [LOCK_FIRST_WORKSPACE, []] })
            em.exists.mockResolvedValue(false)
            em.insert.mockResolvedValue(INSERTED("ws-first") as never)
            const members = mock<WorkspaceMemberDirectoryService>()
            members.holdsAny.mockResolvedValue(false)
            const transaction = fakeTransaction(em)
            const service = await build(em, { allowFreeWorkspace: true }, members)

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
