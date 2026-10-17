import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { WorkspaceMembership } from "@modules/domain/workspaces"
import { WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import {
    SEED_CREDENTIALS_GUIDANCE,
    SEED_OWNER,
    SEED_STAFF,
    SEED_WORKSPACE_NAME,
} from "./messages/workspace-seed.messages"
import type { SeedRequest } from "./workspace-seed.contracts"
import { SEED_AUTH, WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import type { SeedAuth, SeedAuthUser, SeedNewUser, WorkspaceSeedOptions } from "./workspace-seed.options"
import { WorkspaceSeedService } from "./workspace-seed.service"

const REQUEST: SeedRequest = {
    owner: { email: SEED_OWNER.email, name: SEED_OWNER.name, password: "owner-secret-pw" },
    staff: { email: SEED_STAFF.email, name: SEED_STAFF.name, password: "staff-secret-pw" },
}

const noUsers = { data: { users: [] }, error: null }
const created = (user: SeedNewUser) => Promise.resolve({ data: { user: { id: `user-${user.email}` } }, error: null })

const membership = (id: string, role: "owner" | "staff"): WorkspaceMembership => ({
    workspace: {
        id,
        name: "Workspace",
        status: "active",
        ownerId: "o-1",
        createdAt: "2026-10-12T00:00:00.000Z",
        businessType: null,
    },
    member: { userId: "u-1", workspaceId: id, role, staffId: null, displayName: "Member", status: "active" },
})

const usersPage = (count: number, prefix: string): Array<SeedAuthUser> =>
    Array.from({ length: count }, (_, index) => ({
        id: `${prefix}-${index}`,
        ...(index === 0 ? {} : { email: `${prefix}${index}@x.vn` }),
    }))

const build = async (change: Partial<Record<keyof SeedAuth, jest.Mock>> = {}) => {
    const auth = mock<SeedAuth>({
        listUsers: jest.fn().mockResolvedValue(noUsers),
        createUser: jest.fn().mockImplementation(created),
        updateUserById: jest.fn().mockResolvedValue({ error: null }),
        ...change,
    })
    const print = jest.fn()
    const workspaces = mock<WorkspacesService>()
    workspaces.memberships.mockResolvedValue([])
    workspaces.createFree.mockResolvedValue({ id: "ws-new" })
    const members = mock<WorkspaceMembersService>()
    const options = builder<WorkspaceSeedOptions>({ auth: "x", print })()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceSeedService,
            { provide: WORKSPACE_SEED_OPTIONS, useValue: options },
            { provide: SEED_AUTH, useValue: auth },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { seed: moduleRef.get(WorkspaceSeedService), auth, print, workspaces, members }
}

describe("WorkspaceSeedService", () => {
    describe("seed", () => {
        it("creates both accounts, the owner workspace and the staff membership", async () => {
            const { seed, auth, workspaces, members } = await build()

            const report = await seed.seed(REQUEST)

            expect(auth.createUser).toHaveBeenCalledWith({
                email: SEED_OWNER.email,
                password: "owner-secret-pw",
                email_confirm: true,
                user_metadata: { full_name: SEED_OWNER.name },
            })
            expect(workspaces.createFree).toHaveBeenCalledWith(`user-${SEED_OWNER.email}`, SEED_WORKSPACE_NAME)
            expect(members.join).toHaveBeenCalledWith({
                workspaceId: "ws-new",
                userId: `user-${SEED_STAFF.email}`,
                role: "staff",
                staffId: null,
                displayName: SEED_STAFF.name,
            })
            expect(report).toEqual({
                workspaceId: "ws-new",
                lines: [
                    `user created: ${SEED_OWNER.email}`,
                    `user created: ${SEED_STAFF.email}`,
                    "workspace created ws-new",
                    `members: ${SEED_OWNER.email} owner, ${SEED_STAFF.email} staff`,
                ],
            })
        })

        it("updates existing accounts and keeps the workspace the owner already runs", async () => {
            const { seed, auth, workspaces } = await build({
                listUsers: jest.fn().mockResolvedValue({
                    data: {
                        users: [
                            { id: "u-old", email: SEED_OWNER.email.toUpperCase(), user_metadata: { keep: "yes" } },
                            { id: "u-staff", email: SEED_STAFF.email },
                        ],
                    },
                    error: null,
                }),
            })
            workspaces.memberships.mockResolvedValue([membership("ws-staff", "staff"), membership("ws-own", "owner")])

            const report = await seed.seed(REQUEST)

            expect(auth.updateUserById).toHaveBeenCalledWith("u-old", {
                password: "owner-secret-pw",
                email_confirm: true,
                user_metadata: { keep: "yes", full_name: SEED_OWNER.name },
            })
            expect(auth.createUser).not.toHaveBeenCalled()
            expect(workspaces.createFree).not.toHaveBeenCalled()
            expect(report.workspaceId).toBe("ws-own")
            expect(report.lines).toContain(`user exists: ${SEED_OWNER.email} (password set)`)
            expect(report.lines).toContain("workspace kept ws-own")
        })
    })
})

describe("WorkspaceSeedService", () => {
    describe("seed", () => {
        it("finds an account on a later page", async () => {
            const { seed, auth } = await build({
                listUsers: jest
                    .fn()
                    .mockResolvedValueOnce({ data: { users: usersPage(200, "a") }, error: null })
                    .mockResolvedValue({ data: { users: [{ id: "u-late", email: SEED_OWNER.email }] }, error: null }),
            })

            await seed.seed(REQUEST)

            expect(auth.updateUserById).toHaveBeenCalledWith("u-late", expect.anything())
        })

        it("creates an account that no page of users holds, after the last page", async () => {
            const { seed, auth } = await build({
                listUsers: jest.fn().mockResolvedValue({ data: { users: usersPage(200, "b") }, error: null }),
            })

            await seed.seed(REQUEST)

            expect(auth.listUsers).toHaveBeenCalledTimes(98)
            expect(auth.createUser).toHaveBeenCalledTimes(2)
        })

        it.each([
            [
                "listing users fails",
                { listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: { message: "list down" } }) },
                "list down",
            ],
            [
                "updating an account fails",
                {
                    listUsers: jest
                        .fn()
                        .mockResolvedValue({ data: { users: [{ id: "u", email: SEED_OWNER.email }] }, error: null }),
                    updateUserById: jest.fn().mockResolvedValue({ error: { message: "update down" } }),
                },
                "update down",
            ],
            [
                "creating an account fails",
                {
                    createUser: jest
                        .fn()
                        .mockResolvedValue({ data: { user: null }, error: { message: "create down" } }),
                },
                "create down",
            ],
        ])("stops when %s", async (_name, change, message) => {
            const { seed, workspaces } = await build(change)

            await expect(seed.seed(REQUEST)).rejects.toMatchObject({
                code: WorkspaceSeedErrorCode.AuthFailed,
                params: { message },
            })
            expect(workspaces.createFree).not.toHaveBeenCalled()
        })

        it("stops when Auth creates no user", async () => {
            const { seed } = await build({
                createUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
            })

            await expect(seed.seed(REQUEST)).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.RowMissing })
        })
    })
})

describe("WorkspaceSeedService", () => {
    describe("seedOperator", () => {
        it("seeds with fresh passwords and prints the credentials once, guidance and report after seeding", async () => {
            const { seed, auth, members, print } = await build()

            const report = await seed.seedOperator()
            const owner = auth.createUser.mock.calls[0]?.[0]
            const staff = auth.createUser.mock.calls[1]?.[0]

            expect(owner).toEqual({
                email: SEED_OWNER.email,
                password: expect.stringMatching(/^[\w-]{24}$/),
                email_confirm: true,
                user_metadata: { full_name: SEED_OWNER.name },
            })
            expect(staff).toEqual({
                email: SEED_STAFF.email,
                password: expect.stringMatching(/^[\w-]{24}$/),
                email_confirm: true,
                user_metadata: { full_name: SEED_STAFF.name },
            })
            expect(staff?.password).not.toBe(owner?.password)
            expect(print.mock.calls.map(([line]) => line)).toEqual([
                `READY_OWNER_EMAIL=${SEED_OWNER.email}`,
                `READY_OWNER_PASSWORD=${owner?.password}`,
                `READY_STAFF_EMAIL=${SEED_STAFF.email}`,
                `READY_STAFF_PASSWORD=${staff?.password}`,
                SEED_CREDENTIALS_GUIDANCE,
                ...report.lines,
            ])
            expect(SEED_CREDENTIALS_GUIDANCE).toBe(
                "Shown once and not stored. Seal them with `starci app secret set dev test-accounts` " +
                    "(see .starcistacks) before closing this terminal; the next run sets new passwords.",
            )
            expect(print.mock.invocationCallOrder[0]).toBeGreaterThan(members.join.mock.invocationCallOrder[0] ?? 0)
            expect(report.workspaceId).toBe("ws-new")
            expect(report.lines.join("\n")).not.toMatch(/READY_|PASSWORD/)
        })
    })
})

describe("WorkspaceSeedService", () => {
    describe("seedOperator", () => {
        it("sets a new password for both existing accounts on every run", async () => {
            const { seed, auth, print } = await build({
                listUsers: jest.fn().mockResolvedValue({
                    data: {
                        users: [
                            { id: "u-owner", email: SEED_OWNER.email },
                            { id: "u-staff", email: SEED_STAFF.email },
                        ],
                    },
                    error: null,
                }),
            })

            await seed.seedOperator()
            await seed.seedOperator()

            expect(auth.updateUserById).toHaveBeenCalledTimes(4)
            const passwords = auth.updateUserById.mock.calls.map(([, update]) => update.password)
            for (const password of passwords) expect(password).toMatch(/^[\w-]{24}$/)
            expect(new Set(passwords).size).toBe(4)
            expect(auth.updateUserById.mock.calls.map(([id]) => id)).toEqual([
                "u-owner",
                "u-staff",
                "u-owner",
                "u-staff",
            ])
            expect(auth.createUser).not.toHaveBeenCalled()
            expect(print.mock.calls.map(([line]) => line).filter((line) => line.startsWith("READY_"))).toEqual([
                `READY_OWNER_EMAIL=${SEED_OWNER.email}`,
                `READY_OWNER_PASSWORD=${passwords[0]}`,
                `READY_STAFF_EMAIL=${SEED_STAFF.email}`,
                `READY_STAFF_PASSWORD=${passwords[1]}`,
                `READY_OWNER_EMAIL=${SEED_OWNER.email}`,
                `READY_OWNER_PASSWORD=${passwords[2]}`,
                `READY_STAFF_EMAIL=${SEED_STAFF.email}`,
                `READY_STAFF_PASSWORD=${passwords[3]}`,
            ])
        })

        it("prints no credentials when seeding fails", async () => {
            const { seed, print } = await build({
                createUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: "create down" } }),
            })

            await expect(seed.seedOperator()).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.AuthFailed })
            expect(print).not.toHaveBeenCalled()
        })
    })
})
