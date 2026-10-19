import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { SupabaseError, SupabaseErrorCode } from "./errors/supabase.error"
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
const passwordResponse = (): Response =>
    new Response(
        JSON.stringify({
            access_token: "fixture-access",
            refresh_token: "fixture-refresh",
            expires_in: 3600,
            token_type: "bearer",
            user: {
                id: "user-1",
                aud: "authenticated",
                role: "authenticated",
                email: "a@example.test",
                app_metadata: {},
                user_metadata: {},
                created_at: "2026-10-19T00:00:00.000Z",
            },
        }),
        { status: 200 },
    )

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
        await expect(client.openPasswordPrincipal("person@example.test", "fixture-password")).resolves.toBeNull()
        await expect(client.verifyUser("fixture-session")).resolves.toBeNull()

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

describe("createSupabasePublicClient / owned password sessions", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("returns only the user Auth authenticated and keeps session credentials private", async () => {
        const subject = await build()
        const fetch = jest
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(passwordResponse())
            .mockResolvedValue(new Response(null, { status: 204 }))
        const client = subject.createSupabasePublicClient(withPublicKey)
        const session = await client.openPasswordPrincipal("a@example.test", "fixture-password")
        expect(session).toMatchObject({ id: "user-1" })
        expect(JSON.stringify(session)).not.toContain("fixture-")
        await expect(session?.close()).resolves.toBe(true)
        await expect(session?.close()).resolves.toBe(true)
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/logout?scope=local"), expect.any(Object))
    })

    it("retains a failed cleanup result even when the SDK has cleared its local session", async () => {
        const subject = await build()
        const fetch = jest
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(passwordResponse())
            .mockResolvedValueOnce(new Response(JSON.stringify({ msg: "temporarily refused" }), { status: 500 }))
            .mockResolvedValue(new Response(null, { status: 204 }))
        const client = subject.createSupabasePublicClient(withPublicKey)
        const session = await client.openPasswordPrincipal("a@example.test", "fixture-password")
        await expect(session?.close()).resolves.toBe(false)
        await expect(session?.close()).resolves.toBe(false)
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it("does not acknowledge an unexpected cleanup transport failure", async () => {
        const subject = await build(),
            response = new Response(null, { status: 204 })
        Object.defineProperty(response, "ok", {
            get: () => {
                throw new SupabaseError({ code: SupabaseErrorCode.ProviderUnavailable })
            },
        })
        jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(passwordResponse()).mockResolvedValue(response)
        const session = await subject
            .createSupabasePublicClient(withPublicKey)
            .openPasswordPrincipal("a@example.test", "fixture-password")
        await expect(session?.close()).rejects.toMatchObject({ code: SupabaseErrorCode.ProviderUnavailable })
    })
})

describe("createSupabasePublicClient / authenticated identity readback", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("verifies a supplied session with Auth before returning its identity", async () => {
        const subject = await build()
        jest.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    id: "user-2",
                    aud: "authenticated",
                    role: "authenticated",
                    app_metadata: {},
                    user_metadata: {},
                    created_at: "2026-10-19T00:00:00.000Z",
                }),
                { status: 200 },
            ),
        )
        const client = subject.createSupabasePublicClient(withPublicKey)
        await expect(client.verifyUser("fixture-session")).resolves.toBe("user-2")
    })

    it.each(["password", "session"])("returns no identity for a refused %s", async (kind) => {
        const subject = await build()
        jest.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ msg: "invalid credentials", code: "invalid_credentials" }), { status: 401 }),
        )
        const client = subject.createSupabasePublicClient(withPublicKey)
        const result =
            kind === "password"
                ? client.openPasswordPrincipal("a@example.test", "fixture-password")
                : client.verifyUser("fixture-session")
        await expect(result).resolves.toBeNull()
    })

    it.each(["password", "session"])("keeps a malformed %s response non-authenticated", async (kind) => {
        const subject = await build()
        jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }))
        const client = subject.createSupabasePublicClient(withPublicKey)
        const result =
            kind === "password"
                ? client.openPasswordPrincipal("a@example.test", "fixture-password")
                : client.verifyUser("fixture-session")
        await expect(result).resolves.toBeNull()
    })

    it.each(["password", "session"])("keeps a broken transport non-authenticated for %s", async (kind) => {
        const subject = await build(),
            response = new Response("{}", { status: 200 })
        Object.defineProperty(response, "ok", {
            get: () => {
                throw new SupabaseError({ code: SupabaseErrorCode.ProviderUnavailable })
            },
        })
        jest.spyOn(globalThis, "fetch").mockResolvedValue(response)
        const client = subject.createSupabasePublicClient(withPublicKey)
        const result =
            kind === "password"
                ? client.openPasswordPrincipal("a@example.test", "fixture-password")
                : client.verifyUser("fixture-session")
        await expect(result).rejects.toMatchObject({ code: SupabaseErrorCode.ProviderUnavailable })
    })
})
