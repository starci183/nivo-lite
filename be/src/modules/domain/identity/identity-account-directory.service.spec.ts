import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IdentityAccountDirectoryService } from "./identity-account-directory.service"

const USER_BY_ID = 'SELECT * FROM "public"."be_auth_user_by_id"($1)'

const build = async (rows: unknown) => {
    const em = mockEntityManager({ query: [USER_BY_ID, rows] })
    const moduleRef = await Test.createTestingModule({
        providers: [IdentityAccountDirectoryService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { directory: moduleRef.get(IdentityAccountDirectoryService), em }
}

describe("IdentityAccountDirectoryService", () => {
    it("answers the standing of an account that exists", async () => {
        const { directory, em } = await build([
            { id: "u1", email: "an@example.test", last_sign_in_at: null, meta: {}, disabled: false },
        ])

        await expect(directory.find("u1")).resolves.toEqual({ id: "u1", email: "an@example.test", disabled: false })
        expect(em.query).toHaveBeenCalledWith(USER_BY_ID, ["u1"])
    })

    it("answers a disabled account as disabled, and an account without a mailbox with no address", async () => {
        const { directory } = await build([{ id: "u2", email: null, last_sign_in_at: null, meta: {}, disabled: true }])

        await expect(directory.find("u2")).resolves.toEqual({ id: "u2", email: null, disabled: true })
    })

    it("answers undefined for an account that does not exist", async () => {
        const { directory } = await build([])

        await expect(directory.find("ghost")).resolves.toBeUndefined()
    })
})
