import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, mockEntityManager } from "@starci/jest-preset"
import { IdentityErrorCode } from "@modules/domain/identity"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { OWNERS_OPTIONS } from "./owners.decorators"
import { OwnersErrorCode } from "./errors/owners.error"
import { OwnersService } from "./owners.service"

/** The statements `callDbFunction` sends for the account doors and the bcrypt hash. */
const FIND_ACCOUNT = 'SELECT * FROM "public"."be_auth_user_by_email"($1)'
const CREATE_OWNER = 'SELECT * FROM "public"."be_auth_create_user"($1, $2, $3, $4, $5, $6)'
const SET_OWNER_PASSWORD = 'SELECT * FROM "public"."be_auth_set_password"($1, $2, $3)'
const GEN_SALT = 'SELECT * FROM "extensions"."gen_salt"($1, $2)'
const CRYPT = 'SELECT * FROM "extensions"."crypt"($1, $2)'
const SALT = "$2a$10$salt"
const HASH = "$2a$10$hashed"
/** The two statements that hash the password in the database. */
const HASHING: ReadonlyArray<readonly [string, unknown]> = [
    [GEN_SALT, [{ gen_salt: SALT }]],
    [CRYPT, [{ crypt: HASH }]],
]

const NOW = "2026-11-09T10:00:00.000Z"
const CREATED = "00000000-0000-4000-8000-000000000001"

const build = async (stubs: ReadonlyArray<readonly [string, unknown]>) => {
    const em = mockEntityManager({ query: stubs })
    const lines: Array<string> = []
    const moduleRef = await Test.createTestingModule({
        providers: [
            OwnersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: IDS, useValue: fakeIds() },
            { provide: OWNERS_OPTIONS, useValue: { print: (line: string) => lines.push(line) } },
        ],
    }).compile()
    return { service: moduleRef.get(OwnersService), em, lines }
}

describe("OwnersService", () => {
    it("creates a confirmed account with a database-hashed bcrypt password when the address is new", async () => {
        const { service, em, lines } = await build([
            [FIND_ACCOUNT, []],
            ...HASHING,
            [CREATE_OWNER, [{ be_auth_create_user: CREATED }]],
        ])

        await service.createOwner(" Owner@Example.test ", "a-long-password")

        expect(em.query).toHaveBeenCalledWith(FIND_ACCOUNT, ["owner@example.test"])
        expect(em.query).toHaveBeenCalledWith(GEN_SALT, ["bf", 10])
        expect(em.query).toHaveBeenCalledWith(CRYPT, ["a-long-password", SALT])
        expect(em.query).toHaveBeenCalledWith(CREATE_OWNER, [
            CREATED,
            "owner@example.test",
            HASH,
            true,
            "{}",
            new Date(NOW),
        ])
        expect(lines).toEqual(["owner created"])
    })

    it("only sets the password when the address already has an account, so running it twice is safe", async () => {
        const { service, em, lines } = await build([
            [FIND_ACCOUNT, [{ id: "u1" }]],
            ...HASHING,
            [SET_OWNER_PASSWORD, []],
        ])

        await service.createOwner("owner@example.test", "a-long-password")

        expect(em.query).toHaveBeenCalledWith(SET_OWNER_PASSWORD, ["u1", HASH, new Date(NOW)])
        expect(em.query).not.toHaveBeenCalledWith(CREATE_OWNER, expect.anything())
        expect(lines).toEqual(["owner password updated"])
    })

    it("hashes with no salt when the database hands none back", async () => {
        const { service, em } = await build([
            [FIND_ACCOUNT, []],
            [GEN_SALT, []],
            [CRYPT, [{ crypt: HASH }]],
            [CREATE_OWNER, [{ be_auth_create_user: CREATED }]],
        ])

        await service.createOwner("owner@example.test", "a-long-password")

        expect(em.query).toHaveBeenCalledWith(CRYPT, ["a-long-password", undefined])
    })

    it("stops when the database does not hash the password", async () => {
        const { service, lines } = await build([
            [FIND_ACCOUNT, []],
            [GEN_SALT, [{ gen_salt: SALT }]],
            [CRYPT, []],
        ])

        await expect(service.createOwner("owner@example.test", "a-long-password")).rejects.toMatchObject({
            code: OwnersErrorCode.PasswordNotHashed,
        })
        expect(lines).toEqual([])
    })

    it("refuses a password outside the policy before it reads or writes anything", async () => {
        const { service, em, lines } = await build([])

        await expect(service.createOwner("owner@example.test", "short")).rejects.toMatchObject({
            code: IdentityErrorCode.PasswordInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
        expect(lines).toEqual([])
    })
})
