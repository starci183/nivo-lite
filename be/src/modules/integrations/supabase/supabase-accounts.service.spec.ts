import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AuthError } from "@supabase/supabase-js"
import { SupabaseAccountsService } from "./supabase-accounts.service"
import type { SupabaseAdminClient } from "./supabase.client"
import { SUPABASE_ADMIN_CLIENT } from "./supabase.decorators"

type Auth = SupabaseAdminClient["auth"]
type Created = Awaited<ReturnType<Auth["createUser"]>>

const build = async () => {
    const auth = mock<Auth>()
    const admin = mock<SupabaseAdminClient>({ auth })
    const moduleRef = await Test.createTestingModule({
        providers: [SupabaseAccountsService, { provide: SUPABASE_ADMIN_CLIENT, useValue: admin }],
    }).compile()
    return { accounts: moduleRef.get(SupabaseAccountsService), auth }
}

const failed = (message: string): Created => ({ data: { user: null }, error: new AuthError(message) })

describe("SupabaseAccountsService", () => {
    it("answers the page of users the Auth administrator lists", async () => {
        const { accounts, auth } = await build()
        const page = { data: { users: [], aud: "x", nextPage: null, lastPage: 0, total: 0 }, error: null }
        auth.listUsers.mockResolvedValue(page)

        await expect(accounts.listUsers({ page: 1, perPage: 200 })).resolves.toBe(page)
        expect(auth.listUsers).toHaveBeenCalledWith({ page: 1, perPage: 200 })
    })

    it("answers what Auth said about a created user", async () => {
        const { accounts, auth } = await build()
        const answer = failed("already registered")
        auth.createUser.mockResolvedValue(answer)

        await expect(accounts.createUser({ email: "a@b.c", password: "pw", email_confirm: true })).resolves.toBe(answer)
        expect(auth.createUser).toHaveBeenCalledWith({ email: "a@b.c", password: "pw", email_confirm: true })
    })

    it("answers what Auth said about an updated user", async () => {
        const { accounts, auth } = await build()
        const answer = failed("user not found")
        auth.updateUserById.mockResolvedValue(answer)

        await expect(accounts.updateUserById("u-1", { password: "pw2" })).resolves.toBe(answer)
        expect(auth.updateUserById).toHaveBeenCalledWith("u-1", { password: "pw2" })
    })
})
