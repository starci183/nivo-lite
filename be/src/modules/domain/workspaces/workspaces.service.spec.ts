import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspacesErrorCode } from "./errors/workspaces.error"
import type { MembershipRow } from "./persistence/workspaces.rows"
import {
    FIND_WORKSPACE_NAME,
    FIND_NAMED_OWNED_WORKSPACE,
    HAS_ANY_WORKSPACE,
    INSERT_FREE_WORKSPACE,
    LIST_MEMBERSHIPS,
    LOCK_FIRST_WORKSPACE,
    SET_WORKSPACE_BRAND,
} from "./persistence/workspaces.sql"
import type { WorkspacesOptions } from "./workspaces.options"
import { WORKSPACES_OPTIONS } from "./workspaces.port"
import { WorkspacesService } from "./workspaces.service"
import { FIRST_WORKSPACE_NAME } from "./workspaces.templates"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** The match-anything matcher, typed `unknown` so it flows into any slot. */
const anything = (): unknown => expect.anything()

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const rowOf = builder<MembershipRow>({
    workspace_id: "ws-1",
    user_id: "user-1",
    role: "manager",
    staff_id: null,
    display_name: "An",
    status: "active",
    workspace_name: "Quan Ca Phe",
    workspace_status: "active",
    owner_id: "owner-1",
    workspace_created_at: "2026-10-01T00:00:00.000Z",
    business_type: "cafe",
})

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

describe("WorkspacesService", () => {
    describe("ensureNamed", () => {
        it("keeps the exact owned name even when new signup is disabled", async () => {
            const em = mockEntityManager({
                query: [
                    [LOCK_FIRST_WORKSPACE, []],
                    [FIND_NAMED_OWNED_WORKSPACE, [{ id: "ws-1", active: true }]],
                ],
            })
            const transaction = fakeTransaction(em)
            await expect((await build(em)).ensureNamed("owner-1", "Explicit")).resolves.toEqual({ id: "ws-1" })
            expect(em.query.mock.calls).toEqual([
                [LOCK_FIRST_WORKSPACE, ["owner-1"]],
                [FIND_NAMED_OWNED_WORKSPACE, ["owner-1", "Explicit"]],
            ])
            expect(transaction.commits).toBe(1)
        })

        it("creates only after the serialized exact-name lookup found none", async () => {
            const em = mockEntityManager({
                query: [
                    [LOCK_FIRST_WORKSPACE, []],
                    [FIND_NAMED_OWNED_WORKSPACE, []],
                    [INSERT_FREE_WORKSPACE, [{ id: "ws-new" }]],
                ],
            })
            const transaction = fakeTransaction(em)
            await expect(
                (await build(em, { allowFreeWorkspace: true })).ensureNamed("owner-1", "Explicit"),
            ).resolves.toEqual({ id: "ws-new" })
            expect(em.query).toHaveBeenLastCalledWith(INSERT_FREE_WORKSPACE, ["owner-1", "Explicit"])
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
            const em = mockEntityManager({
                query: [
                    [LOCK_FIRST_WORKSPACE, []],
                    [FIND_NAMED_OWNED_WORKSPACE, rows],
                ],
            })
            const transaction = fakeTransaction(em)
            await expect((await build(em)).ensureNamed("owner-1", "Explicit")).rejects.toMatchObject({ code })
            expect(transaction.rollbacks).toBe(1)
            expect(em.query).not.toHaveBeenCalledWith(INSERT_FREE_WORKSPACE, anything())
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
            const em = mockEntityManager({ query: [FIND_WORKSPACE_NAME, [{ name: "Quan Ca Phe" }]] })

            await expect((await build(em)).nameOf("ws-1")).resolves.toBe("Quan Ca Phe")
            expect(em.query).toHaveBeenCalledWith(FIND_WORKSPACE_NAME, ["ws-1"])
        })

        it("answers empty text for a missing workspace", async () => {
            const em = mockEntityManager({ query: [FIND_WORKSPACE_NAME, []] })

            await expect((await build(em)).nameOf("ws-missing")).resolves.toBe("")
            expect(em.query).toHaveBeenCalledWith(FIND_WORKSPACE_NAME, ["ws-missing"])
        })
    })
})

describe("WorkspacesService", () => {
    describe("memberships", () => {
        it("maps each membership with its workspace", async () => {
            const em = mockEntityManager({ query: [LIST_MEMBERSHIPS, [rowOf()]] })

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
            expect(em.query).toHaveBeenCalledWith(LIST_MEMBERSHIPS, ["user-1"])
        })
    })
})

describe("WorkspacesService", () => {
    describe("createFree", () => {
        it("creates an active workspace owned by the person where signup is allowed", async () => {
            const em = mockEntityManager({ query: [INSERT_FREE_WORKSPACE, [{ id: "ws-new" }]] })
            const service = await build(em, { allowFreeWorkspace: true })

            await expect(service.createFree("user-1", "NIVO Workspace")).resolves.toEqual({ id: "ws-new" })
            expect(em.query).toHaveBeenCalledWith(INSERT_FREE_WORKSPACE, ["user-1", "NIVO Workspace"])
        })

        it("refuses where signup is switched off", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).createFree("user-1", "NIVO Workspace")).rejects.toMatchObject({
                code: WorkspacesErrorCode.SignupDisabled,
            })
            expect(em.query).not.toHaveBeenCalled()
        })
    })
})

describe("WorkspacesService", () => {
    describe("setBrand", () => {
        const brand = { displayName: "Brand Name", logoUrl: "/brand/logo.jpg" }

        it("writes the brand only where the workspace is owned by the caller", async () => {
            const em = mockEntityManager({ query: [SET_WORKSPACE_BRAND, [{ id: "ws-1" }]] })

            await expect((await build(em)).setBrand("owner-1", "ws-1", brand)).resolves.toBeUndefined()
            expect(em.query).toHaveBeenCalledWith(SET_WORKSPACE_BRAND, [
                "ws-1",
                "owner-1",
                "Brand Name",
                "/brand/logo.jpg",
            ])
        })

        it("refuses as not found when no owned workspace matched", async () => {
            const em = mockEntityManager({ query: [SET_WORKSPACE_BRAND, []] })

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

        it("locks the person's first load and keeps their existing workspace", async () => {
            const em = mockEntityManager({
                query: [
                    [LOCK_FIRST_WORKSPACE, []],
                    [HAS_ANY_WORKSPACE, [{ taken: true }]],
                ],
            })
            const transaction = fakeTransaction(em)
            const service = await build(em, { allowFreeWorkspace: true })

            await expect(service.startFirst("user-1")).resolves.toEqual({ id: null })
            expect(em.query.mock.calls).toEqual([
                [LOCK_FIRST_WORKSPACE, ["user-1"]],
                [HAS_ANY_WORKSPACE, ["user-1"]],
            ])
            expect(transaction.commits).toBe(1)
            expect(transaction.committedWrites).toEqual([])
        })

        it.each([
            { label: "the check has no row", rows: [] },
            { label: "the check says untaken", rows: [{ taken: false }] },
        ])("creates the first workspace when $label", async ({ rows }) => {
            const em = mockEntityManager({
                query: [
                    [LOCK_FIRST_WORKSPACE, []],
                    [HAS_ANY_WORKSPACE, rows],
                    [INSERT_FREE_WORKSPACE, [{ id: "ws-first" }]],
                ],
            })
            const transaction = fakeTransaction(em)
            const service = await build(em, { allowFreeWorkspace: true })

            await expect(service.startFirst("user-1")).resolves.toEqual({ id: "ws-first" })
            expect(em.query.mock.calls).toEqual([
                [LOCK_FIRST_WORKSPACE, ["user-1"]],
                [HAS_ANY_WORKSPACE, ["user-1"]],
                [INSERT_FREE_WORKSPACE, ["user-1", FIRST_WORKSPACE_NAME]],
            ])
            expect(transaction.commits).toBe(1)
            expect(transaction.rollbacks).toBe(0)
            expect(em.transaction).toHaveBeenCalledTimes(1)
        })
    })
})
