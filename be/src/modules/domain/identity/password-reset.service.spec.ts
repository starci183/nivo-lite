import { Test } from "@nestjs/testing"
import { IsNull, MoreThan } from "typeorm"
import { FakeClock, builder, fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { MAIL } from "@modules/integrations/mail"
import type { MailClient } from "@modules/integrations/mail"
import { PASSPORT_PASSWORDS } from "@modules/integrations/passport"
import type { PassportPasswordsClient } from "@modules/integrations/passport"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { Principal } from "@modules/platform/cqrs"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IdentityAttemptsService } from "./attempts.service"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { IDENTITY_AUTH_OPTIONS } from "./identity-auth.decorators"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { IdentityPasswordResetService } from "./password-reset.service"
import { digestOf } from "./password.policy"
import { IdentityPasswordTokenEntity } from "./persistence/entities"

/** The statements `callDbFunction` sends for the account doors. */
const USER_BY_EMAIL = 'SELECT * FROM "public"."be_auth_user_by_email"($1)'
const SET_PASSWORD = 'SELECT * FROM "public"."be_auth_set_password"($1, $2, $3)'
const CLOSE_USER_SESSIONS = 'SELECT * FROM "public"."be_auth_close_user_sessions"($1)'

const NOW = "2026-11-09T10:00:00.000Z"
const OPTIONS: IdentityAuthOptions = {
    webOrigin: "https://app.example.test",
    cookieDomain: undefined,
    refreshTtlSeconds: 3600,
    resetTtlSeconds: 3600,
    inviteTtlSeconds: 7200,
    loginAttempts: 3,
    resetAttempts: 2,
    attemptWindowMs: 60_000,
}
const passwordTokenFor = (purpose: IdentityPasswordTokenEntity["purpose"]): IdentityPasswordTokenEntity =>
    builder<IdentityPasswordTokenEntity>({
        id: "p1",
        userId: "u1",
        tokenHash: "hash",
        purpose,
        createdAt: new Date("2026-11-09T09:00:00.000Z"),
        expiresAt: new Date("2026-11-09T12:00:00.000Z"),
        usedAt: null,
    })()

const ACCOUNT = {
    id: "u1",
    email: "an@example.test",
    encrypted_password: null,
    email_confirmed_at: NOW,
    disabled: false,
}

interface Stubs {
    readonly query?: ReadonlyArray<readonly [string, unknown]>
    readonly token?: IdentityPasswordTokenEntity | null
}

const build = async (stubs: Stubs, allowed = true) => {
    const em = mockEntityManager({
        query: stubs.query ?? [],
        findOne: [IdentityPasswordTokenEntity, stubs.token ?? null],
        insert: [IdentityPasswordTokenEntity, {}],
        update: [IdentityPasswordTokenEntity, { affected: 1 }],
    })
    fakeTransaction(em)
    const passwords = mock<PassportPasswordsClient>()
    passwords.hash.mockResolvedValue("$2b$10$new")
    const attempts = mock<IdentityAttemptsService>()
    if (!allowed) attempts.admit.mockRejectedValue(new IdentityError({ code: IdentityErrorCode.TooManyAttempts }))
    const mail = mock<MailClient>()
    mail.sendThroughPlatform.mockResolvedValue({ messageId: "m1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentityPasswordResetService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: PASSPORT_PASSWORDS, useValue: passwords },
            { provide: IdentityAttemptsService, useValue: attempts },
            { provide: MAIL, useValue: mail },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: IDS, useValue: fakeIds() },
            { provide: IDENTITY_AUTH_OPTIONS, useValue: OPTIONS },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { service: moduleRef.get(IdentityPasswordResetService), em, mail, attempts, passwords }
}

describe("IdentityPasswordResetService / request", () => {
    it("mails a single-use link and stores only the hash of its token", async () => {
        const { service, em, mail } = await build({
            query: [[USER_BY_EMAIL, [ACCOUNT]]],
        })

        await service.request("An@Example.test")

        const stored = em.insert.mock.calls[0]?.[1]
        const sent = mail.sendThroughPlatform.mock.calls[0]?.[0]
        const token = /token=([a-f0-9]+)/u.exec(sent?.text ?? "")?.[1] ?? ""
        expect(sent?.to).toBe("an@example.test")
        expect(token).not.toBe("")
        expect(stored).toMatchObject({ userId: "u1", tokenHash: digestOf(token), purpose: "reset" })
    })

    it("answers the same for an address with no account and sends nothing", async () => {
        const { service, mail } = await build({ query: [[USER_BY_EMAIL, []]] })

        await expect(service.request("ghost@example.test")).resolves.toBeUndefined()

        expect(mail.sendThroughPlatform).not.toHaveBeenCalled()
    })

    it("rate limits an address", async () => {
        const { service, mail, attempts } = await build({}, false)

        await expect(service.request("an@example.test")).rejects.toMatchObject({
            code: IdentityErrorCode.TooManyAttempts,
        })

        expect(attempts.admit).toHaveBeenCalledWith("reset", "an@example.test")
        expect(mail.sendThroughPlatform).not.toHaveBeenCalled()
    })

    it("does not fail the request when the mail cannot be sent", async () => {
        const { service, mail } = await build({
            query: [[USER_BY_EMAIL, [ACCOUNT]]],
        })
        mail.sendThroughPlatform.mockRejectedValue(new Error("smtp down"))

        await expect(service.request("an@example.test")).resolves.toBeUndefined()
    })
})

describe("IdentityPasswordResetService / complete", () => {
    it("spends the link, sets the password and ends every session", async () => {
        const { service, em } = await build({
            query: [
                [SET_PASSWORD, []],
                [CLOSE_USER_SESSIONS, [{ be_auth_close_user_sessions: 2 }]],
            ],
            token: passwordTokenFor("reset"),
        })

        await service.complete("a".repeat(40), "a-new-password")

        expect(em.findOne).toHaveBeenCalledWith(IdentityPasswordTokenEntity, {
            where: { tokenHash: digestOf("a".repeat(40)), usedAt: IsNull(), expiresAt: MoreThan(new Date(NOW)) },
            lock: { mode: "pessimistic_write" },
        })
        expect(em.update).toHaveBeenCalledWith(
            IdentityPasswordTokenEntity,
            { userId: "u1", usedAt: IsNull() },
            { usedAt: new Date(NOW) },
        )
        expect(em.query).toHaveBeenCalledWith(SET_PASSWORD, ["u1", "$2b$10$new", new Date(NOW)])
        expect(em.query).toHaveBeenCalledWith(CLOSE_USER_SESSIONS, ["u1"])
    })

    it("spends an invitation link the same way", async () => {
        const { service, em } = await build({
            query: [
                [SET_PASSWORD, []],
                [CLOSE_USER_SESSIONS, [{ be_auth_close_user_sessions: 0 }]],
            ],
            token: passwordTokenFor("invite"),
        })

        await service.complete("d".repeat(40), "a-new-password")

        expect(em.query).toHaveBeenCalledWith(SET_PASSWORD, ["u1", "$2b$10$new", new Date(NOW)])
    })

    it("refuses an unknown, used or expired link without changing anything", async () => {
        const { service, em } = await build({ token: null })

        await expect(service.complete("b".repeat(40), "a-new-password")).rejects.toMatchObject({
            code: IdentityErrorCode.ResetTokenInvalid,
        })
        expect(em.query).not.toHaveBeenCalledWith(SET_PASSWORD, expect.anything())
    })

    it("refuses a password outside the policy before touching the link", async () => {
        const { service, em } = await build({})

        await expect(service.complete("c".repeat(40), "short")).rejects.toMatchObject({
            code: IdentityErrorCode.PasswordInvalid,
        })
        await expect(service.complete("c".repeat(40), "x".repeat(73))).rejects.toMatchObject({
            code: IdentityErrorCode.PasswordInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
    })
})

const PRINCIPAL: Principal = { id: "u1", email: "An@Example.test", role: "authenticated" }
const STORED = { ...ACCOUNT, encrypted_password: "$2a$10$stored" }

describe("IdentityPasswordResetService / change", () => {
    it("sets the new password of a person who proves the current one", async () => {
        const { service, em, passwords, attempts } = await build({
            query: [
                [USER_BY_EMAIL, [STORED]],
                [SET_PASSWORD, []],
            ],
        })
        passwords.verify.mockResolvedValue(true)

        await expect(service.change(PRINCIPAL, "current-pw", "a-new-password")).resolves.toBeUndefined()

        expect(attempts.admit).toHaveBeenCalledWith("login", "an@example.test")
        expect(passwords.verify).toHaveBeenCalledWith("current-pw", "$2a$10$stored")
        expect(em.query).toHaveBeenCalledWith(SET_PASSWORD, ["u1", "$2b$10$new", new Date(NOW)])
    })

    it("refuses a caller whose token carries no email, and a new password outside the policy", async () => {
        const { service, em } = await build({})

        await expect(
            service.change({ id: "u1", role: "authenticated" }, "current-pw", "a-new-password"),
        ).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })
        await expect(service.change(PRINCIPAL, "current-pw", "short")).rejects.toMatchObject({
            code: IdentityErrorCode.PasswordInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a wrong current password, an unreadable one and an account of someone else", async () => {
        const wrong = await build({ query: [[USER_BY_EMAIL, [STORED]]] })
        wrong.passwords.verify.mockResolvedValue(false)
        await expect(wrong.service.change(PRINCIPAL, "wrong", "a-new-password")).rejects.toMatchObject({
            code: IdentityErrorCode.InvalidCredentials,
        })

        const long = await build({ query: [[USER_BY_EMAIL, [STORED]]] })
        long.passwords.verify.mockResolvedValue(false)
        await expect(long.service.change(PRINCIPAL, "x".repeat(200), "a-new-password")).rejects.toMatchObject({
            code: IdentityErrorCode.InvalidCredentials,
        })
        expect(long.passwords.verify).toHaveBeenCalledWith("", "$2a$10$stored")

        const other = await build({ query: [[USER_BY_EMAIL, [{ ...STORED, id: "u2" }]]] })
        other.passwords.verify.mockResolvedValue(true)
        await expect(other.service.change(PRINCIPAL, "current-pw", "a-new-password")).rejects.toMatchObject({
            code: IdentityErrorCode.InvalidCredentials,
        })

        const unknown = await build({ query: [[USER_BY_EMAIL, []]] })
        unknown.passwords.verify.mockResolvedValue(false)
        await expect(unknown.service.change(PRINCIPAL, "current-pw", "a-new-password")).rejects.toMatchObject({
            code: IdentityErrorCode.InvalidCredentials,
        })
        expect(unknown.passwords.verify).toHaveBeenCalledWith("current-pw", "")
        expect(unknown.em.query).not.toHaveBeenCalledWith(SET_PASSWORD, expect.anything())
    })
})
