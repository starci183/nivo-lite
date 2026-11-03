import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { AuthPasswords, SignInBudget } from "@modules/integrations/passport"
import { CLOCK } from "@modules/platform/clock"
import type { Principal } from "@modules/platform/cqrs"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { behaveAsSignInBudget } from "@tests/fixtures/builders/sign-in-budget.builder"
import { IdentityErrorCode } from "./errors/identity.error"
import { IDENTITY_AUTH_PASSWORDS, IDENTITY_SIGN_IN_BUDGET } from "./identity.decorators"
import { IdentityPasswordChangeService } from "./password-change.service"

/** The statements `callDbFunction` sends for the account doors. */
const USER_BY_EMAIL = 'SELECT * FROM "public"."be_auth_user_by_email"($1)'
const SET_PASSWORD = 'SELECT * FROM "public"."be_auth_set_password"($1, $2, $3, $4)'

const NOW = "2026-11-09T10:00:00.000Z"
const PRINCIPAL: Principal = { id: "u1", email: "An@Example.test", role: "authenticated" }
const STORED = {
    id: "u1",
    email: "an@example.test",
    encrypted_password: "$2a$10$stored",
    email_confirmed_at: new Date(NOW),
    disabled: false,
}

const build = async (query: ReadonlyArray<readonly [string, unknown]>) => {
    const em = mockEntityManager({ query })
    const passwords = mock<AuthPasswords>()
    passwords.hash.mockResolvedValue("$2b$10$new")
    const budget = mock<SignInBudget>()
    behaveAsSignInBudget(budget, true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentityPasswordChangeService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: IDENTITY_AUTH_PASSWORDS, useValue: passwords },
            { provide: IDENTITY_SIGN_IN_BUDGET, useValue: budget },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(IdentityPasswordChangeService), em, passwords, budget }
}

describe("IdentityPasswordChangeService / change", () => {
    it("sets the new password of a person who proves the current one", async () => {
        const { service, em, passwords, budget } = await build([
            [USER_BY_EMAIL, [STORED]],
            [SET_PASSWORD, []],
        ])
        passwords.verify.mockResolvedValue(true)

        await expect(service.change(PRINCIPAL, "current-pw", "a-new-password")).resolves.toBeUndefined()

        expect(budget.admit).toHaveBeenCalledWith("login", "an@example.test")
        expect(budget.clear.mock.calls).toEqual([["login", "an@example.test"]])
        expect(passwords.verify).toHaveBeenCalledWith("current-pw", "$2a$10$stored")
        expect(em.query).toHaveBeenCalledWith(SET_PASSWORD, ["u1", "$2b$10$new", false, new Date(NOW)])
    })

    it("refuses a caller whose token carries no email, and a new password outside the policy", async () => {
        const { service, em } = await build([])

        await expect(
            service.change({ id: "u1", role: "authenticated" }, "current-pw", "a-new-password"),
        ).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })
        await expect(service.change(PRINCIPAL, "current-pw", "short")).rejects.toMatchObject({
            code: IdentityErrorCode.PasswordInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a wrong current password, an unreadable one and an account of someone else", async () => {
        const wrong = await build([[USER_BY_EMAIL, [STORED]]])
        wrong.passwords.verify.mockResolvedValue(false)
        await expect(wrong.service.change(PRINCIPAL, "wrong", "a-new-password")).rejects.toMatchObject({
            code: IdentityErrorCode.PairRefused,
        })
        expect(wrong.budget.clear).not.toHaveBeenCalled()

        const long = await build([[USER_BY_EMAIL, [STORED]]])
        long.passwords.verify.mockResolvedValue(false)
        await expect(long.service.change(PRINCIPAL, "x".repeat(200), "a-new-password")).rejects.toMatchObject({
            code: IdentityErrorCode.PairRefused,
        })
        expect(long.passwords.verify).toHaveBeenCalledWith("", "$2a$10$stored")

        const other = await build([[USER_BY_EMAIL, [{ ...STORED, id: "u2" }]]])
        other.passwords.verify.mockResolvedValue(true)
        await expect(other.service.change(PRINCIPAL, "current-pw", "a-new-password")).rejects.toMatchObject({
            code: IdentityErrorCode.PairRefused,
        })

        const unknown = await build([[USER_BY_EMAIL, []]])
        unknown.passwords.verify.mockResolvedValue(false)
        await expect(unknown.service.change(PRINCIPAL, "current-pw", "a-new-password")).rejects.toMatchObject({
            code: IdentityErrorCode.PairRefused,
        })
        expect(unknown.passwords.verify).toHaveBeenCalledWith("current-pw", "")
        expect(unknown.em.query).not.toHaveBeenCalledWith(SET_PASSWORD, expect.anything())
    })
})
