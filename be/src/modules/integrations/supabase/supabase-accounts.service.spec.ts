import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AuthError } from "@supabase/supabase-js"
import { SupabaseAccountsService } from "./supabase-accounts.service"
import type { SupabaseAdminClient, SupabasePublicClient } from "./supabase.client"
import { SUPABASE_ADMIN_CLIENT, SUPABASE_PUBLIC_CLIENT } from "./supabase.decorators"

type Auth = SupabaseAdminClient["auth"]
type Created = Awaited<ReturnType<Auth["createUser"]>>

const build = async () => {
    const auth = mock<Auth>()
    const admin = mock<SupabaseAdminClient>({ auth })
    const publicClient = mock<SupabasePublicClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SupabaseAccountsService,
            { provide: SUPABASE_ADMIN_CLIENT, useValue: admin },
            { provide: SUPABASE_PUBLIC_CLIENT, useValue: publicClient },
        ],
    }).compile()
    return { accounts: moduleRef.get(SupabaseAccountsService), auth, publicClient }
}

const failed = (message: string): Created => ({ data: { user: null }, error: new AuthError(message) })

describe("SupabaseAccountsService", () => {
    it("authenticates user passwords with the public Auth owner rather than admin identity", async () => {
        const { accounts, publicClient } = await build()
        const session = { id: "user-1", close: () => Promise.resolve(true) }
        publicClient.openPasswordPrincipal.mockResolvedValue(session)
        await expect(accounts.openPasswordPrincipal("a@example.test", "fixture-password")).resolves.toBe(session)
        expect(publicClient.openPasswordPrincipal).toHaveBeenCalledWith("a@example.test", "fixture-password")
    })

    it("authenticates a session without accepting a caller supplied user id", async () => {
        const { accounts, publicClient } = await build()
        publicClient.verifyUser.mockResolvedValue(null)
        await expect(accounts.verifyUser("fixture-session")).resolves.toBeNull()
        expect(publicClient.verifyUser).toHaveBeenCalledWith("fixture-session")
    })
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

    it("answers what Auth said about a deleted user", async () => {
        const { accounts, auth } = await build()
        const answer = failed("user not found")
        auth.deleteUser.mockResolvedValue(answer)

        await expect(accounts.deleteUser("u-1")).resolves.toBe(answer)
        expect(auth.deleteUser).toHaveBeenCalledWith("u-1")
    })
})
