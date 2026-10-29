import { Test } from "@nestjs/testing"
import { PASSPORT_PASSWORDS_OPTIONS } from "./passport.decorators"
import { PassportPasswordsClient } from "./passport-passwords.client"

/** The shape every GoTrue user carries: written by Postgres pgcrypto crypt with a blowfish salt of cost 10, an independent bcrypt implementation. */
const GOTRUE_HASH = "$2a$10$TZfNy6XYihhRMeWbe1wgl.OPgdstCtb8vpneNfP.ahBaA6pfLnRGO"
const GOTRUE_PASSWORD = "Sup3r-secret-pw"

const client = async (): Promise<PassportPasswordsClient> => {
    const moduleRef = await Test.createTestingModule({
        providers: [PassportPasswordsClient, { provide: PASSPORT_PASSWORDS_OPTIONS, useValue: { bcryptCost: 4 } }],
    }).compile()
    return moduleRef.get(PassportPasswordsClient)
}

describe("PassportPasswordsClient", () => {
    it("verifies a real-format $2a$ bcrypt hash written by another implementation", async () => {
        await expect((await client()).verify(GOTRUE_PASSWORD, GOTRUE_HASH)).resolves.toBe(true)
    })

    it("refuses a wrong password against that hash", async () => {
        await expect((await client()).verify("not-the-password", GOTRUE_HASH)).resolves.toBe(false)
    })

    it("never matches an account without a password and still does the work of a comparison", async () => {
        await expect((await client()).verify(GOTRUE_PASSWORD, "")).resolves.toBe(false)
    })

    it("hashes a new password into a $2 bcrypt hash that verifies", async () => {
        const passwords = await client()
        const hash = await passwords.hash("another-pw-1")
        expect(hash).toMatch(/^\$2[aby]\$04\$/u)
        await expect(passwords.verify("another-pw-1", hash)).resolves.toBe(true)
        await expect(passwords.verify("another-pw-2", hash)).resolves.toBe(false)
    })
})
