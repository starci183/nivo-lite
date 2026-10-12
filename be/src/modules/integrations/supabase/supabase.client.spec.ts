import { Secret } from "@modules/platform/config"
import { createSupabaseAdminClient, createSupabasePublicClient } from "./supabase.client"
import type { SupabaseOptions } from "./supabase.options"

const options: SupabaseOptions = {
    url: "https://project.supabase.test",
    serviceRoleKey: new Secret("service-role-key"),
}

const withPublicKey: SupabaseOptions = { ...options, anonKey: new Secret("publishable-key") }

describe("createSupabaseAdminClient", () => {
    it("exposes Auth administration and Storage, and nothing else", () => {
        const client = createSupabaseAdminClient(options)

        expect(Object.keys(client).sort()).toEqual(["auth", "storage"])
        expect(typeof client.auth.createUser).toBe("function")
        expect(typeof client.auth.deleteUser).toBe("function")
        expect(typeof client.storage.from).toBe("function")
    })

    it("builds a separate client for every call", () => {
        const first = createSupabaseAdminClient(options)
        const second = createSupabaseAdminClient(options)

        expect(first.auth).not.toBe(second.auth)
        expect(first.storage).not.toBe(second.storage)
    })
})

describe("createSupabasePublicClient", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("sends nothing and answers false when no publishable key is configured", async () => {
        const fetch = jest.spyOn(globalThis, "fetch")
        const client = createSupabasePublicClient(options)

        await expect(client.sendSignInLink("person@example.test", "https://app.test/next")).resolves.toBe(false)

        expect(fetch).not.toHaveBeenCalled()
    })

    it("reports a sign-in link as sent when Auth accepts the request", async () => {
        const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }))
        const client = createSupabasePublicClient(withPublicKey)

        await expect(client.sendSignInLink("person@example.test", "https://app.test/next")).resolves.toBe(true)

        expect(fetch).toHaveBeenCalledTimes(1)
    })

    it("reports a sign-in link as not sent when Auth refuses it", async () => {
        jest.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ msg: "Signups not allowed for otp", error_code: "otp_disabled" }), {
                status: 422,
            }),
        )
        const client = createSupabasePublicClient(withPublicKey)

        await expect(client.sendSignInLink("nobody@example.test", "https://app.test/next")).resolves.toBe(false)
    })
})
