import { Test } from "@nestjs/testing"
import { IsNull, MoreThan } from "typeorm"
import { FakeClock, builder, fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { MAIL } from "@modules/integrations/mail"
import type { MailClient } from "@modules/integrations/mail"
import { PASSPORT_PASSWORDS } from "@modules/integrations/passport"
import type { PassportPasswordsClient } from "@modules/integrations/passport"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
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
import { IdentitySignupService } from "./signup.service"

/** The statements `callDbFunction` sends for the account doors. */
const USER_BY_EMAIL = 'SELECT * FROM "public"."be_auth_user_by_email"($1)'
const CREATE_USER = 'SELECT * FROM "public"."be_auth_create_user"($1, $2, $3, $4, $5, $6)'
const CONFIRM_EMAIL = 'SELECT * FROM "public"."be_auth_confirm_email"($1, $2)'

const NOW = "2026-11-09T10:00:00.000Z"
const CREATED = "00000000-0000-4000-8000-000000000001"
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
const unconfirmed = {
    id: "u1",
    email: "an@example.test",
    encrypted_password: "$2b$10$h",
    email_confirmed_at: null,
    disabled: false,
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

const build = async (
    stubs: ReadonlyArray<readonly [string, unknown]>,
    allowed = true,
    token: IdentityPasswordTokenEntity | null = null,
) => {
    const em = mockEntityManager({
        query: stubs,
        findOne: [IdentityPasswordTokenEntity, token],
        update: [IdentityPasswordTokenEntity, { affected: 1 }],
    })
    fakeTransaction(em)
    const passwords = mock<PassportPasswordsClient>()
    passwords.hash.mockResolvedValue("$2b$10$hashed")
    const attempts = mock<IdentityAttemptsService>()
    if (!allowed) attempts.admit.mockRejectedValue(new IdentityError({ code: IdentityErrorCode.TooManyAttempts }))
    const mail = mock<MailClient>()
    mail.sendThroughPlatform.mockResolvedValue({ messageId: "m1" })
    const resets = mock<IdentityPasswordResetService>()
    resets.mint.mockResolvedValue("minted-token")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentitySignupService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: PASSPORT_PASSWORDS, useValue: passwords },
            { provide: IdentityAttemptsService, useValue: attempts },
            { provide: MAIL, useValue: mail },
            { provide: IdentityPasswordResetService, useValue: resets },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: IDS, useValue: fakeIds() },
            { provide: IDENTITY_AUTH_OPTIONS, useValue: OPTIONS },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(IdentitySignupService), em, mail, attempts, resets, logger }
}

describe("IdentitySignupService / signup", () => {
    it("creates an unconfirmed account with a bcrypt hash and mails the confirmation link", async () => {
        const { service, em, mail, resets, attempts } = await build([
            [USER_BY_EMAIL, []],
            [CREATE_USER, [{ be_auth_create_user: CREATED }]],
        ])

        await service.signup("An Nguyen", " An@Example.test ", "a-long-password")

        expect(attempts.admit).toHaveBeenCalledWith("signup", "an@example.test")
        expect(em.query).toHaveBeenCalledWith(CREATE_USER, [
            CREATED,
            "an@example.test",
            "$2b$10$hashed",
            false,
            '{"full_name":"An Nguyen"}',
            new Date(NOW),
        ])
        expect(resets.mint).toHaveBeenCalledWith(CREATED, "confirm", 3600)
        const sent = mail.sendThroughPlatform.mock.calls[0]?.[0]
        expect(sent?.to).toBe("an@example.test")
        expect(sent?.text).toContain("https://app.example.test/auth/confirm?token=minted-token")
    })

    it("mails the link to the generated id when the create door answers none", async () => {
        const { service, resets } = await build([
            [USER_BY_EMAIL, []],
            [CREATE_USER, []],
        ])

        await service.signup("An", "an@example.test", "a-long-password")

        expect(resets.mint).toHaveBeenCalledWith(CREATED, "confirm", 3600)
    })

    it("still answers when the confirmation mail cannot be sent, and logs it", async () => {
        const { service, mail, logger } = await build([[USER_BY_EMAIL, [unconfirmed]]])
        const failure = new Error("smtp down")
        mail.sendThroughPlatform.mockRejectedValue(failure)

        await expect(service.signup("An", "an@example.test", "a-long-password")).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith("identity.mail.failed", failure, { kind: "confirm" })
    })

    it("answers an address that already has a confirmed account the same way, without mailing or creating anything", async () => {
        const { service, em, mail } = await build([[USER_BY_EMAIL, [{ ...unconfirmed, email_confirmed_at: NOW }]]])

        await expect(service.signup("An", "an@example.test", "a-long-password")).resolves.toBeUndefined()

        expect(mail.sendThroughPlatform).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalledWith(CREATE_USER, expect.anything())
    })

    it("mails the link again for an address whose account is still unconfirmed", async () => {
        const { service, mail } = await build([[USER_BY_EMAIL, [unconfirmed]]])

        await service.signup("An", "an@example.test", "a-long-password")

        expect(mail.sendThroughPlatform).toHaveBeenCalledTimes(1)
    })

    it("refuses a password outside the policy and a rate limited address before touching the database", async () => {
        const weak = await build([])
        await expect(weak.service.signup("An", "an@example.test", "short")).rejects.toMatchObject({
            code: IdentityErrorCode.PasswordInvalid,
        })
        expect(weak.em.query).not.toHaveBeenCalled()

        const limited = await build([], false)
        await expect(limited.service.signup("An", "an@example.test", "a-long-password")).rejects.toMatchObject({
            code: IdentityErrorCode.TooManyAttempts,
        })
        expect(limited.em.query).not.toHaveBeenCalled()
    })
})

describe("IdentitySignupService / resend and confirm", () => {
    it("mails the link again only to an unconfirmed account", async () => {
        const open = await build([[USER_BY_EMAIL, [unconfirmed]]])
        await open.service.resend("an@example.test")
        expect(open.mail.sendThroughPlatform).toHaveBeenCalledTimes(1)

        const done = await build([[USER_BY_EMAIL, [{ ...unconfirmed, email_confirmed_at: NOW }]]])
        await done.service.resend("an@example.test")
        expect(done.mail.sendThroughPlatform).not.toHaveBeenCalled()
    })

    it("confirms the mailbox when a confirmation link is spent", async () => {
        const { service, em } = await build([[CONFIRM_EMAIL, []]], true, passwordTokenFor("confirm"))

        await service.confirm("a".repeat(40))

        expect(em.findOne).toHaveBeenCalledWith(IdentityPasswordTokenEntity, {
            where: { tokenHash: digestOf("a".repeat(40)), usedAt: IsNull(), expiresAt: MoreThan(new Date(NOW)) },
            lock: { mode: "pessimistic_write" },
        })
        expect(em.update).toHaveBeenCalledWith(
            IdentityPasswordTokenEntity,
            { userId: "u1", usedAt: IsNull() },
            { usedAt: new Date(NOW) },
        )
        expect(em.query).toHaveBeenCalledWith(CONFIRM_EMAIL, ["u1", new Date(NOW)])
    })

    it("refuses an unknown link and a password link used as a confirmation", async () => {
        const unknown = await build([], true, null)
        await expect(unknown.service.confirm("b".repeat(40))).rejects.toMatchObject({
            code: IdentityErrorCode.ResetTokenInvalid,
        })

        const wrong = await build([], true, passwordTokenFor("reset"))
        await expect(wrong.service.confirm("c".repeat(40))).rejects.toMatchObject({
            code: IdentityErrorCode.ResetTokenInvalid,
        })
        expect(wrong.em.query).not.toHaveBeenCalledWith(CONFIRM_EMAIL, expect.anything())
    })
})
