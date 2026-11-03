import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, mock, mockEntityManager } from "@starci/jest-preset"
import { AUTH_ERROR_CODES, AuthError } from "@modules/integrations/passport"
import type { AuthPasswords, AuthSessions } from "@modules/integrations/passport"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IdentityAccountsService } from "./accounts.service"
import { IdentityAuthenticatorService } from "./authenticator.service"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { ACCESS_TOKEN_VERIFIER, IDENTITY_AUTH_PASSWORDS, IDENTITY_AUTH_SESSIONS } from "./identity.decorators"
import type { VerifyAccessToken } from "./identity.contracts"
import { IdentityInviteService } from "./identity-invite.service"

/** The statements `callDbFunction` sends for the account doors. */
const USER_BY_ID = 'SELECT * FROM "public"."be_auth_user_by_id"($1)'
const CREATE_USER = 'SELECT * FROM "public"."be_auth_create_user"($1, $2, $3, $4, $5, $6)'
const SET_AVATAR = 'SELECT * FROM "public"."be_auth_set_avatar"($1, $2)'
const LIST_USERS = 'SELECT * FROM "public"."be_auth_list_users"($1, $2)'
const DELETE_USER = 'SELECT * FROM "public"."be_auth_delete_user"($1)'

const NOW = "2026-11-09T10:00:00.000Z"
const CREATED = "00000000-0000-4000-8000-000000000001"
const person = (meta: Record<string, unknown>, email: string | null = "an@example.test") => ({
    id: "u1",
    email,
    last_sign_in_at: NOW,
    meta,
    disabled: false,
})

const build = async (stubs: ReadonlyArray<readonly [string, unknown]>) => {
    const em = mockEntityManager({ query: stubs })
    const invites = mock<IdentityInviteService>()
    const authenticator = mock<IdentityAuthenticatorService>()
    const sessions = mock<AuthSessions>()
    const passwords = mock<AuthPasswords>()
    passwords.hash.mockResolvedValue("hashed")
    const verifierDouble = mock<{ verify: VerifyAccessToken }>()
    const verifier = verifierDouble.verify
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentityAccountsService,
            { provide: IdentityInviteService, useValue: invites },
            { provide: IdentityAuthenticatorService, useValue: authenticator },
            { provide: IDENTITY_AUTH_SESSIONS, useValue: sessions },
            { provide: IDENTITY_AUTH_PASSWORDS, useValue: passwords },
            { provide: ACCESS_TOKEN_VERIFIER, useValue: verifier },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: IDS, useValue: fakeIds() },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return {
        service: moduleRef.get(IdentityAccountsService),
        em,
        invites,
        authenticator,
        sessions,
        passwords,
        verifier,
    }
}

describe("IdentityAccountsService / accountOf", () => {
    it("reads the name, picture and last sign-in of an account", async () => {
        const { service } = await build([
            [USER_BY_ID, [person({ full_name: "An Nguyen", avatar_url: "https://img.example.test/a.png" })]],
        ])

        await expect(service.accountOf("u1")).resolves.toEqual({
            kind: "ok",
            value: {
                email: "an@example.test",
                lastSignInAt: NOW,
                displayName: "An Nguyen",
                avatarUrl: "https://img.example.test/a.png",
                uploadedAvatarUrl: null,
            },
        })
    })

    it("prefers the picture the person uploaded and falls back to the email name", async () => {
        const { service } = await build([
            [USER_BY_ID, [person({ nivo_avatar_url: "https://cdn.example.test/me.png" })]],
        ])

        await expect(service.accountOf("u1")).resolves.toMatchObject({
            value: {
                displayName: "an",
                avatarUrl: "https://cdn.example.test/me.png",
                uploadedAvatarUrl: "https://cdn.example.test/me.png",
            },
        })
    })

    it("ignores an uploaded picture that is not an HTTPS address, and names an account with no email Owner", async () => {
        const { service } = await build([
            [USER_BY_ID, [person({ nivo_avatar_url: "http://insecure.example.test/x.png" }, null)]],
        ])

        await expect(service.accountOf("u1")).resolves.toMatchObject({
            value: { displayName: "Owner", uploadedAvatarUrl: null, avatarUrl: null, email: "" },
        })
    })

    it("answers no last sign-in for an account that never signed in", async () => {
        const { service } = await build([[USER_BY_ID, [{ ...person({}), last_sign_in_at: null }]]])

        await expect(service.accountOf("u1")).resolves.toMatchObject({ value: { lastSignInAt: null } })
    })

    it("refuses an account that does not exist", async () => {
        const { service } = await build([[USER_BY_ID, []]])

        await expect(service.accountOf("ghost")).resolves.toMatchObject({
            kind: "refused",
            code: IdentityErrorCode.AccountNotFound,
        })
    })
})

describe("IdentityAccountsService / setUploadedAvatar", () => {
    it("keeps or drops the uploaded picture and refuses an unknown account", async () => {
        const kept = await build([[SET_AVATAR, [{ be_auth_set_avatar: true }]]])
        await expect(kept.service.setUploadedAvatar("u1", "https://cdn.example.test/me.png")).resolves.toEqual({
            kind: "ok",
            value: true,
        })
        expect(kept.em.query).toHaveBeenCalledWith(SET_AVATAR, ["u1", "https://cdn.example.test/me.png"])

        const unknown = await build([[SET_AVATAR, [{ be_auth_set_avatar: false }]]])
        await expect(unknown.service.setUploadedAvatar("ghost", null)).resolves.toMatchObject({
            kind: "refused",
            code: IdentityErrorCode.AccountNotFound,
        })
    })
})

describe("IdentityAccountsService / deliverInvite", () => {
    it("hands the invitation to the invite service and answers how it left", async () => {
        const { service, invites } = await build([])
        invites.deliver.mockResolvedValue("invited")

        await expect(service.deliverInvite("An@Example.test", "https://app.example.test/invite/token-1")).resolves.toBe("invited")

        expect(invites.deliver).toHaveBeenCalledWith("An@Example.test", "https://app.example.test/invite/token-1")
    })
})

const started = (cookieToken: string): Awaited<ReturnType<AuthSessions["start"]>> => ({
    accessToken: "access",
    accessExpiresAt: NOW,
    accessExpiresIn: 900,
    cookieToken,
    refreshMaxAgeSeconds: 3600,
    user: { id: "u1", email: "an@example.test" },
})

describe("IdentityAccountsService / listUsers", () => {
    it("lists one page of people through the bounded door", async () => {
        const { service, em } = await build([
            [LIST_USERS, [{ id: "u1", email: "an@example.test", meta: { full_name: "An" } }]],
        ])

        await expect(service.listUsers({ page: 2, perPage: 50 })).resolves.toEqual({
            data: { users: [{ id: "u1", email: "an@example.test", user_metadata: { full_name: "An" } }] },
            error: null,
        })
        expect(em.query).toHaveBeenCalledWith(LIST_USERS, [2, 50])
    })

    it("lists a person without an email as an empty address", async () => {
        const { service } = await build([[LIST_USERS, [{ id: "u2", email: null, meta: {} }]]])

        await expect(service.listUsers({ page: 1, perPage: 10 })).resolves.toEqual({
            data: { users: [{ id: "u2", email: "", user_metadata: {} }] },
            error: null,
        })
    })

    it("answers a failure of the list door instead of throwing", async () => {
        const { service, em } = await build([])
        em.query.mockRejectedValue(new Error("db down"))

        await expect(service.listUsers({ page: 1, perPage: 10 })).resolves.toEqual({
            data: { users: [] },
            error: { message: "db down" },
        })
    })
})

describe("IdentityAccountsService / createUser", () => {
    it("creates a confirmed person with a hashed password", async () => {
        const { service, em, passwords } = await build([[CREATE_USER, [{ be_auth_create_user: CREATED }]]])

        await expect(
            service.createUser({
                email: " An@Example.test ",
                password: "a-long-password",
                email_confirm: true,
                user_metadata: { full_name: "An" },
            }),
        ).resolves.toEqual({ data: { user: { id: CREATED } }, error: null })

        expect(passwords.hash).toHaveBeenCalledWith("a-long-password")
        expect(em.query).toHaveBeenCalledWith(CREATE_USER, [
            CREATED,
            "an@example.test",
            "hashed",
            true,
            '{"full_name":"An"}',
            new Date(NOW),
        ])
    })

    it("answers the failure when the person cannot be created", async () => {
        const { service } = await build([[CREATE_USER, []]])

        await expect(
            service.createUser({
                email: "a@example.test",
                password: "a-long-password",
                email_confirm: true,
                user_metadata: {},
            }),
        ).resolves.toEqual({ data: { user: null }, error: { message: "The account was not created." } })
    })
})

describe("IdentityAccountsService / createUser failures", () => {
    it("answers the failure of the create door, naming a thrown value that is not an error generically", async () => {
        const account = {
            email: "a@example.test",
            password: "a-long-password",
            email_confirm: false,
            user_metadata: {},
        }
        const failing = await build([])
        failing.em.query.mockRejectedValue(new Error("db down"))
        await expect(failing.service.createUser(account)).resolves.toEqual({
            data: { user: null },
            error: { message: "db down" },
        })

        const odd = await build([])
        odd.em.query.mockRejectedValue("refused")
        await expect(odd.service.createUser(account)).resolves.toEqual({
            data: { user: null },
            error: { message: "The account door failed." },
        })
    })
})

describe("IdentityAccountsService / deleteUser", () => {
    it("deletes a person and answers a failure of the door", async () => {
        const deleted = await build([[DELETE_USER, [{ be_auth_delete_user: true }]]])
        await expect(deleted.service.deleteUser("u1")).resolves.toEqual({ error: null })
        expect(deleted.em.query).toHaveBeenCalledWith(DELETE_USER, ["u1"])

        const failing = await build([])
        failing.em.query.mockRejectedValue(new Error("locked"))
        await expect(failing.service.deleteUser("u1")).resolves.toEqual({ error: { message: "locked" } })
    })
})

describe("IdentityAccountsService / principal sessions and tokens", () => {
    it("opens a principal session on a right password and closes only its own session once", async () => {
        const { service, authenticator, sessions } = await build([])
        authenticator.verifyPassword.mockResolvedValue({ userId: "u1", email: "an@example.test" })
        sessions.start.mockResolvedValue(started("cookie-1"))
        sessions.end.mockResolvedValue()

        const principal = await service.openPasswordPrincipal("an@example.test", "right")

        expect(principal?.id).toBe("u1")
        expect(sessions.start).toHaveBeenCalledWith(
            { userId: "u1", email: "an@example.test" },
            { userAgent: null, ip: null },
        )
        await expect(principal?.close()).resolves.toBe(true)
        await expect(principal?.close()).resolves.toBe(true)
        expect(sessions.end).toHaveBeenCalledTimes(1)
        expect(sessions.end).toHaveBeenCalledWith("cookie-1")
    })

    it("reports a session that could not be closed", async () => {
        const { service, authenticator, sessions } = await build([])
        authenticator.verifyPassword.mockResolvedValue({ userId: "u1", email: "an@example.test" })
        sessions.start.mockResolvedValue(started("cookie-1"))
        sessions.end.mockRejectedValue(new Error("db down"))

        const principal = await service.openPasswordPrincipal("an@example.test", "right")

        await expect(principal?.close()).resolves.toBe(false)
    })

    it("refuses a wrong password without opening a session, and lets an unexpected failure through", async () => {
        const { service, authenticator, sessions } = await build([])
        authenticator.verifyPassword.mockRejectedValueOnce(
            new IdentityError({ code: IdentityErrorCode.PairRefused }),
        )

        await expect(service.openPasswordPrincipal("an@example.test", "wrong")).resolves.toBeNull()
        expect(sessions.start).not.toHaveBeenCalled()

        authenticator.verifyPassword.mockRejectedValueOnce(new AuthError(AUTH_ERROR_CODES.TooManyAttempts))
        await expect(service.openPasswordPrincipal("an@example.test", "guess")).resolves.toBeNull()

        authenticator.verifyPassword.mockRejectedValueOnce(new Error("db down"))
        await expect(service.openPasswordPrincipal("an@example.test", "x")).rejects.toThrow("db down")
    })

    it("answers only the id of a verified access token", async () => {
        const { service, verifier } = await build([])
        verifier.mockResolvedValueOnce({ kind: "ok", value: { id: "u1", role: "authenticated" } })
        verifier.mockResolvedValueOnce({ kind: "refused", code: IdentityErrorCode.AccessTokenInvalid })

        await expect(service.verifyUser("good")).resolves.toBe("u1")
        await expect(service.verifyUser("bad")).resolves.toBeNull()
    })
})
