import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import {
    createSupabaseAdminClient as realCreateSupabaseAdminClient,
    createSupabasePublicClient as realCreateSupabasePublicClient,
} from "./supabase.client"
import type { SupabaseOptions } from "./supabase.options"

const SUBJECT = Symbol("supabase.client")
type Subject = {
    createSupabaseAdminClient: typeof realCreateSupabaseAdminClient
    createSupabasePublicClient: typeof realCreateSupabasePublicClient
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    createSupabaseAdminClient: realCreateSupabaseAdminClient,
                    createSupabasePublicClient: realCreateSupabasePublicClient,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const options: SupabaseOptions = {
    url: "https://project.supabase.test",
    serviceRoleKey: new Secret("service-role-key"),
}

const withPublicKey: SupabaseOptions = { ...options, anonKey: new Secret("publishable-key") }

describe("createSupabaseAdminClient", () => {
    it("exposes Auth administration and Storage, and nothing else", async () => {
        const subject = await build()

        const client = subject.createSupabaseAdminClient(options)

        expect(Object.keys(client).sort()).toEqual(["auth", "storage"])
        expect(typeof client.auth.createUser).toBe("function")
        expect(typeof client.auth.deleteUser).toBe("function")
        expect(typeof client.storage.from).toBe("function")
    })

    it("builds a separate client for every call", async () => {
        const subject = await build()

        const first = subject.createSupabaseAdminClient(options)
        const second = subject.createSupabaseAdminClient(options)

        expect(first.auth).not.toBe(second.auth)
        expect(first.storage).not.toBe(second.storage)
    })
})

describe("createSupabasePublicClient", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("sends nothing and answers false when no publishable key is configured", async () => {
        const subject = await build()

        const fetch = jest.spyOn(globalThis, "fetch")
        const client = subject.createSupabasePublicClient(options)

        await expect(client.sendSignInLink("person@example.test", "https://app.test/next")).resolves.toBe(false)

        expect(fetch).not.toHaveBeenCalled()
    })

    it("reports a sign-in link as sent when Auth accepts the request", async () => {
        const subject = await build()

        const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }))
        const client = subject.createSupabasePublicClient(withPublicKey)

        await expect(client.sendSignInLink("person@example.test", "https://app.test/next")).resolves.toBe(true)

        expect(fetch).toHaveBeenCalledTimes(1)
    })

    it("reports a sign-in link as not sent when Auth refuses it", async () => {
        const subject = await build()

        jest.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ msg: "Signups not allowed for otp", error_code: "otp_disabled" }), {
                status: 422,
            }),
        )
        const client = subject.createSupabasePublicClient(withPublicKey)

        await expect(client.sendSignInLink("nobody@example.test", "https://app.test/next")).resolves.toBe(false)
    })
})
