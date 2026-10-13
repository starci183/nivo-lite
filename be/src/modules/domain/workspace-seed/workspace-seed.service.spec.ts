import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { WorkspaceMembership } from "@modules/domain/workspaces"
import { WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { SEED_OWNER, SEED_STAFF, SEED_WORKSPACE_NAME } from "./messages/workspace-seed.messages"
import type { SeedRequest } from "./workspace-seed.contracts"
import { SEED_AUTH, WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import type { SeedAuth, SeedAuthUser, SeedNewUser } from "./workspace-seed.options"
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

const build = async (change: Partial<SeedAuth> = {}, stored = "") => {
    const auth = mock<SeedAuth>({
        listUsers: jest.fn().mockResolvedValue(noUsers),
        createUser: jest.fn().mockImplementation(created),
        updateUserById: jest.fn().mockResolvedValue({ error: null }),
        ...change,
    })
    const secrets = {
        location: "/home/op/.nivo-lite/secrets.env",
        read: jest.fn().mockResolvedValue(stored),
        write: jest.fn().mockResolvedValue(undefined),
    }
    const print = jest.fn()
    const workspaces = mock<WorkspacesService>()
    workspaces.memberships.mockResolvedValue([])
    workspaces.createFree.mockResolvedValue({ id: "ws-new" })
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceSeedService,
            { provide: WORKSPACE_SEED_OPTIONS, useValue: { auth: "x", secrets, print } },
            { provide: SEED_AUTH, useValue: auth },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { seed: moduleRef.get(WorkspaceSeedService), auth, secrets, print, workspaces, members }
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

    describe("seedOperator", () => {
        it("generates and stores the passwords of a first run before touching Auth, then prints the report", async () => {
            const { seed, auth, secrets, print } = await build()

            const report = await seed.seedOperator()

            expect(secrets.write.mock.calls[0]?.[0]).toMatch(
                /^READY_OWNER_EMAIL=mai@nivo.vn\nREADY_OWNER_PASSWORD=[\w-]{24}\nREADY_STAFF_EMAIL=ha@nivo.vn\nREADY_STAFF_PASSWORD=[\w-]{24}\n$/,
            )
            expect(secrets.write.mock.invocationCallOrder[0]).toBeLessThan(
                auth.listUsers.mock.invocationCallOrder[0] ?? 0,
            )
            expect(report.lines[0]).toBe("credentials kept in /home/op/.nivo-lite/secrets.env")
            expect(print.mock.calls.map(([line]) => line)).toEqual(report.lines)
            expect(report.lines.join("\n")).not.toMatch(/READY_|PASSWORD/)
        })

        it("keeps the stored password of an account and replaces one that is too short", async () => {
            const stored = [
                "OTHER=1",
                `READY_OWNER_EMAIL=${SEED_OWNER.email}`,
                "READY_OWNER_PASSWORD=owner-password-0123456789",
                `READY_STAFF_EMAIL=${SEED_STAFF.email}`,
                "READY_STAFF_PASSWORD=short",
                "",
            ].join("\n")
            const { seed, auth } = await build({}, stored)

            await seed.seedOperator()

            expect(auth.createUser).toHaveBeenCalledWith(
                expect.objectContaining({ password: "owner-password-0123456789" }),
            )
            expect(auth.createUser).toHaveBeenCalledWith(
                expect.objectContaining({ email: SEED_STAFF.email, password: expect.stringMatching(/^[\w-]{24}$/) }),
            )
        })
    })
})
