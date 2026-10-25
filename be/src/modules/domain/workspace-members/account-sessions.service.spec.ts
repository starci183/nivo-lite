import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { AccountSessionsService } from "./account-sessions.service"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import { LIST_PROVIDERS, LIST_SESSIONS, REVOKE_SESSION } from "./persistence/account-sessions.sql"
import type { AccountDirectory } from "./workspace-members.contracts"
import { ACCOUNT_DIRECTORY } from "./workspace-members.port"

const CREATED = new Date("2026-10-01T00:00:00.000Z")
const ACTIVE = "2026-10-11T08:30:00.000Z"

const build = async (entityManager: MockEntityManager) => {
    const accounts = mock<AccountDirectory>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountSessionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ACCOUNT_DIRECTORY, useValue: accounts },
        ],
    }).compile()
    return { service: moduleRef.get(AccountSessionsService), accounts }
}

describe("AccountSessionsService / overview", () => {
    it("puts the current device first and reads the profile the directory knows", async () => {
        const em = mockEntityManager({
            query: [
                [LIST_PROVIDERS, [{ provider: "google" }, { provider: "email" }]],
                [
                    LIST_SESSIONS,
                    [
                        {
                            id: "s-old",
                            created_at: null,
                            last_active_at: null,
                            user_agent: null,
                            ip: null,
                        },
                        {
                            id: "s-now",
                            created_at: CREATED,
                            last_active_at: ACTIVE,
                            user_agent: "Mozilla",
                            ip: "127.0.0.1",
                        },
                    ],
                ],
            ],
        })
        const { service, accounts } = await build(em)
        accounts.accountOf.mockResolvedValue(ok({ email: "an@example.test", lastSignInAt: ACTIVE, displayName: "An" }))

        await expect(service.overview("user-1", "s-now")).resolves.toEqual({
            name: "An",
            email: "an@example.test",
            avatarUrl: null,
            uploadedAvatarUrl: null,
            providers: ["google", "email"],
            sessions: [
                {
                    id: "s-now",
                    userAgent: "Mozilla",
                    ip: "127.0.0.1",
                    createdAt: "2026-10-01T00:00:00.000Z",
                    lastActiveAt: ACTIVE,
                    isCurrent: true,
                },
                {
                    id: "s-old",
                    userAgent: null,
                    ip: null,
                    createdAt: null,
                    lastActiveAt: null,
                    isCurrent: false,
                },
            ],
        })
        expect(accounts.accountOf).toHaveBeenCalledWith("user-1")
        expect(em.query).toHaveBeenCalledWith(LIST_PROVIDERS, ["user-1"])
        expect(em.query).toHaveBeenCalledWith(LIST_SESSIONS, ["user-1"])
    })
})

describe("AccountSessionsService / overview", () => {
    it("blanks the profile the directory does not know and marks no device current", async () => {
        const em = mockEntityManager({
            query: [
                [LIST_PROVIDERS, []],
                [
                    LIST_SESSIONS,
                    [
                        {
                            id: "s-1",
                            created_at: ACTIVE,
                            last_active_at: CREATED,
                            user_agent: "curl",
                            ip: "10.0.0.2",
                        },
                    ],
                ],
            ],
        })
        const { service, accounts } = await build(em)
        accounts.accountOf.mockResolvedValue(refused("ACCOUNT_NOT_FOUND"))

        await expect(service.overview("user-1")).resolves.toEqual({
            name: "",
            email: "",
            avatarUrl: null,
            uploadedAvatarUrl: null,
            providers: [],
            sessions: [
                {
                    id: "s-1",
                    userAgent: "curl",
                    ip: "10.0.0.2",
                    createdAt: ACTIVE,
                    lastActiveAt: "2026-10-01T00:00:00.000Z",
                    isCurrent: false,
                },
            ],
        })
    })
})

describe("AccountSessionsService / revokeSession", () => {
    it("refuses the session the request runs on and deletes nothing", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.revokeSession("user-1", "s-now", "s-now")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.CurrentSession,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a session the account does not have", async () => {
        const em = mockEntityManager({ query: [REVOKE_SESSION, []] })
        const { service } = await build(em)

        await expect(service.revokeSession("user-1", "s-missing", "s-now")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.SessionNotFound,
        })
        expect(em.query).toHaveBeenCalledWith(REVOKE_SESSION, ["user-1", "s-missing"])
    })

    it("refuses a session the database did not delete", async () => {
        const em = mockEntityManager({ query: [REVOKE_SESSION, [{ revoked: false }]] })
        const { service } = await build(em)

        await expect(service.revokeSession("user-1", "s-old")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.SessionNotFound,
        })
    })

    it("deletes another session of the account", async () => {
        const em = mockEntityManager({ query: [REVOKE_SESSION, [{ revoked: true }]] })
        const { service } = await build(em)

        await expect(service.revokeSession("user-1", "s-old", "s-now")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(REVOKE_SESSION, ["user-1", "s-old"])
    })
})
