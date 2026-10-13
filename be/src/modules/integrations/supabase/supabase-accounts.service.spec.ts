import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { SupabaseAccountsService } from "./supabase-accounts.service"
import type { SupabaseAdminClient } from "./supabase.client"
import { SUPABASE_ADMIN_CLIENT } from "./supabase.decorators"

describe("SupabaseAccountsService", () => {
    it("hands each call to the Auth administrator", async () => {
        const auth = mock<SupabaseAdminClient["auth"]>()
        auth.listUsers.mockResolvedValue({
            data: { users: [], aud: "x", nextPage: null, lastPage: 0, total: 0 },
            error: null,
        })
        const admin = mock<SupabaseAdminClient>({ auth })
        const moduleRef = await Test.createTestingModule({
            providers: [SupabaseAccountsService, { provide: SUPABASE_ADMIN_CLIENT, useValue: admin }],
        }).compile()
        const accounts = moduleRef.get(SupabaseAccountsService)

        const listed = await accounts.listUsers({ page: 1, perPage: 200 })
        void accounts.createUser({ email: "a@b.c", password: "pw", email_confirm: true })
        void accounts.updateUserById("u-1", { password: "pw2" })

        expect(listed.error).toBeNull()
        expect(listed.data.users).toEqual([])
        expect(auth.listUsers).toHaveBeenCalledWith({ page: 1, perPage: 200 })
        expect(auth.createUser).toHaveBeenCalledWith({ email: "a@b.c", password: "pw", email_confirm: true })
        expect(auth.updateUserById).toHaveBeenCalledWith("u-1", { password: "pw2" })
    })
})
