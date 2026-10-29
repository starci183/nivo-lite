import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PASSPORT_PASSWORDS } from "@modules/integrations/passport"
import type { GoogleProfile, PassportPasswordsClient } from "@modules/integrations/passport"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IdentityAuthenticatorService } from "./authenticator.service"
import { IdentityAttemptsService } from "./attempts.service"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"

/** The statements `callDbFunction` sends for the account doors. */
const USER_BY_EMAIL = "SELECT * FROM public.be_auth_user_by_email($1)"
const USER_BY_ID = "SELECT * FROM public.be_auth_user_by_id($1)"
const USER_BY_GOOGLE = "SELECT * FROM public.be_auth_user_by_google($1)"
const CREATE_USER = "SELECT * FROM public.be_auth_create_user($1, $2, $3, $4, $5, $6)"
const LINK_GOOGLE = "SELECT * FROM public.be_auth_link_google($1, $2, $3, $4)"
const TOUCH_USER = "SELECT * FROM public.be_auth_touch_user($1, $2, $3, $4)"

const NOW = "2026-11-09T10:00:00.000Z"
const ACCOUNT = {
    id: "u1",
    email: "an@example.test",
    encrypted_password: "$2a$10$stored",
    email_confirmed_at: NOW,
    disabled: false,
}
const GOOGLE: GoogleProfile = {
    subject: "g-1",
    email: "An@Example.test",
    emailVerified: true,
    name: "An Nguyen",
    picture: "https://img.example.test/an.png",
}
const PERSON = {
    id: "u9",
    email: "an@example.test",
    last_sign_in_at: null,
    meta: {},
    disabled: false,
}

interface Stubs {
    readonly query?: ReadonlyArray<readonly [string, unknown]>
}

const build = async (stubs: Stubs, allowed = true, matches = true) => {
    const em = mockEntityManager({ query: stubs.query ?? [] })
    fakeTransaction(em)
    const passwords = mock<PassportPasswordsClient>()
    passwords.verify.mockResolvedValue(matches)
    const attempts = mock<IdentityAttemptsService>()
    if (!allowed) attempts.admit.mockRejectedValue(new IdentityError({ code: IdentityErrorCode.TooManyAttempts }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentityAuthenticatorService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: PASSPORT_PASSWORDS, useValue: passwords },
            { provide: IdentityAttemptsService, useValue: attempts },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: IDS, useValue: fakeIds() },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { service: moduleRef.get(IdentityAuthenticatorService), em, passwords, attempts }
}

describe("IdentityAuthenticatorService / verifyPassword", () => {
    it("admits the right password and counts the attempt against the hashed address", async () => {
        const { service, em, passwords, attempts } = await build({
            query: [
                [USER_BY_EMAIL, [ACCOUNT]],
                [TOUCH_USER, []],
            ],
        })

        await expect(service.verifyPassword("  An@Example.test ", "right-pw")).resolves.toEqual({
            userId: "u1",
            email: "an@example.test",
        })

        expect(attempts.admit).toHaveBeenCalledWith("login", "an@example.test")
        expect(em.query).toHaveBeenCalledWith(USER_BY_EMAIL, ["an@example.test"])
        expect(passwords.verify).toHaveBeenCalledWith("right-pw", "$2a$10$stored")
    })

    it("answers the same refusal for a wrong password and for an unknown address", async () => {
        const wrong = await build({ query: [[USER_BY_EMAIL, [ACCOUNT]]] }, true, false)
        await expect(wrong.service.verifyPassword("an@example.test", "bad")).rejects.toMatchObject({
            code: IdentityErrorCode.InvalidCredentials,
        })

        const unknown = await build({ query: [[USER_BY_EMAIL, []]] }, true, false)
        await expect(unknown.service.verifyPassword("ghost@example.test", "bad")).rejects.toMatchObject({
            code: IdentityErrorCode.InvalidCredentials,
        })
        expect(unknown.passwords.verify).toHaveBeenCalledWith("bad", "")
    })

    it("refuses a disabled account even with the right password", async () => {
        const { service } = await build({ query: [[USER_BY_EMAIL, [{ ...ACCOUNT, disabled: true }]]] })

        await expect(service.verifyPassword("an@example.test", "right-pw")).rejects.toMatchObject({
            code: IdentityErrorCode.AccountDisabled,
        })
    })

    it("refuses an account whose mailbox was never confirmed, even with the right password", async () => {
        const { service } = await build({ query: [[USER_BY_EMAIL, [{ ...ACCOUNT, email_confirmed_at: null }]]] })

        await expect(service.verifyPassword("an@example.test", "right-pw")).rejects.toMatchObject({
            code: IdentityErrorCode.EmailNotConfirmed,
        })
    })

    it("rate limits an address before it reads the account", async () => {
        const { service, em, passwords } = await build({}, false)

        await expect(service.verifyPassword("an@example.test", "guess")).rejects.toMatchObject({
            code: IdentityErrorCode.TooManyAttempts,
        })

        expect(em.query).not.toHaveBeenCalled()
        expect(passwords.verify).not.toHaveBeenCalled()
    })

    it("refuses a password longer than bcrypt reads without comparing it", async () => {
        const { service, passwords } = await build({ query: [[USER_BY_EMAIL, [ACCOUNT]]] }, true, false)

        await expect(service.verifyPassword("an@example.test", "x".repeat(200))).rejects.toMatchObject({
            code: IdentityErrorCode.InvalidCredentials,
        })
        expect(passwords.verify).toHaveBeenCalledWith("", "$2a$10$stored")
    })
})

describe("IdentityAuthenticatorService / signInWithGoogle", () => {
    it("signs in the account a Google subject is already linked to", async () => {
        const { service, em } = await build({
            query: [
                [USER_BY_GOOGLE, [{ be_auth_user_by_google: "u9" }]],
                [LINK_GOOGLE, []],
                [TOUCH_USER, []],
                [USER_BY_ID, [PERSON]],
            ],
        })

        await expect(service.signInWithGoogle(GOOGLE)).resolves.toEqual({ userId: "u9", email: "an@example.test" })

        expect(em.query).not.toHaveBeenCalledWith(USER_BY_EMAIL, expect.anything())
        expect(em.query).not.toHaveBeenCalledWith(CREATE_USER, expect.anything())
    })

    it("links an existing account by its verified email and confirms the mailbox", async () => {
        const { service, em } = await build({
            query: [
                [USER_BY_GOOGLE, [{ be_auth_user_by_google: null }]],
                [USER_BY_EMAIL, [{ ...ACCOUNT, id: "u9" }]],
                [LINK_GOOGLE, []],
                [TOUCH_USER, []],
                [USER_BY_ID, [PERSON]],
            ],
        })

        await expect(service.signInWithGoogle(GOOGLE)).resolves.toMatchObject({ userId: "u9" })

        expect(em.query).toHaveBeenCalledWith(USER_BY_EMAIL, ["an@example.test"])
        expect(em.query).toHaveBeenCalledWith(LINK_GOOGLE, [
            "u9",
            "g-1",
            expect.stringContaining('"sub":"g-1"'),
            new Date(NOW),
        ])
        expect(em.query).toHaveBeenCalledWith(TOUCH_USER, [
            "u9",
            new Date(NOW),
            true,
            expect.stringContaining("An Nguyen"),
        ])
        expect(em.query).not.toHaveBeenCalledWith(CREATE_USER, expect.anything())
    })
})

describe("IdentityAuthenticatorService / signInWithGoogle (new accounts and refusals)", () => {
    it("creates a confirmed account without a password when nobody has that email", async () => {
        const created = "00000000-0000-4000-8000-000000000001"
        const { service, em } = await build({
            query: [
                [USER_BY_GOOGLE, [{ be_auth_user_by_google: null }]],
                [USER_BY_EMAIL, []],
                [CREATE_USER, [{ be_auth_create_user: created }]],
                [LINK_GOOGLE, []],
                [TOUCH_USER, []],
                [USER_BY_ID, [PERSON]],
            ],
        })

        await service.signInWithGoogle(GOOGLE)

        expect(em.query).toHaveBeenCalledWith(CREATE_USER, [
            created,
            "an@example.test",
            null,
            true,
            expect.stringContaining('"full_name":"An Nguyen"'),
            new Date(NOW),
        ])
        expect(em.query).toHaveBeenCalledWith(LINK_GOOGLE, [
            created,
            "g-1",
            expect.stringContaining("g-1"),
            new Date(NOW),
        ])
    })

    it("refuses a profile whose email Google did not verify, and touches nothing", async () => {
        const { service, em } = await build({})

        await expect(service.signInWithGoogle({ ...GOOGLE, emailVerified: false })).rejects.toMatchObject({
            code: IdentityErrorCode.GoogleEmailUnverified,
        })
        await expect(service.signInWithGoogle({ ...GOOGLE, email: null })).rejects.toMatchObject({
            code: IdentityErrorCode.GoogleEmailUnverified,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a disabled account", async () => {
        const { service } = await build({
            query: [
                [USER_BY_GOOGLE, [{ be_auth_user_by_google: "u9" }]],
                [LINK_GOOGLE, []],
                [TOUCH_USER, []],
                [USER_BY_ID, [{ ...PERSON, disabled: true }]],
            ],
        })

        await expect(service.signInWithGoogle(GOOGLE)).rejects.toMatchObject({
            code: IdentityErrorCode.AccountDisabled,
        })
    })
})

describe("IdentityAuthenticatorService / signInWithGoogle (sparse profiles and lost accounts)", () => {
    const created = "00000000-0000-4000-8000-000000000001"
    const sparse = [
        [USER_BY_GOOGLE, [{ be_auth_user_by_google: null }]],
        [USER_BY_EMAIL, []],
        [LINK_GOOGLE, []],
        [TOUCH_USER, []],
        [USER_BY_ID, [PERSON]],
    ] as const

    it("keeps only the verified keys of a profile without a name or a picture, and the generated id when the door answers none", async () => {
        const { service, em } = await build({ query: [...sparse, [CREATE_USER, []]] })

        await expect(service.signInWithGoogle({ ...GOOGLE, name: null, picture: null })).resolves.toMatchObject({
            userId: "u9",
        })

        expect(em.query).toHaveBeenCalledWith(CREATE_USER, [
            created,
            "an@example.test",
            null,
            true,
            '{"email":"An@Example.test","email_verified":true}',
            new Date(NOW),
        ])
        expect(em.query).toHaveBeenCalledWith(LINK_GOOGLE, [
            created,
            "g-1",
            expect.stringContaining("g-1"),
            new Date(NOW),
        ])
    })

    it("refuses an account that vanished or has no email once it is linked", async () => {
        const gone = await build({ query: [...sparse.slice(0, 4), [USER_BY_ID, []], [CREATE_USER, []]] })
        await expect(gone.service.signInWithGoogle(GOOGLE)).rejects.toMatchObject({
            code: IdentityErrorCode.AccountNotFound,
        })

        const mailless = await build({
            query: [...sparse.slice(0, 4), [USER_BY_ID, [{ ...PERSON, email: null }]], [CREATE_USER, []]],
        })
        await expect(mailless.service.signInWithGoogle(GOOGLE)).rejects.toMatchObject({
            code: IdentityErrorCode.AccountNotFound,
        })
    })
})
