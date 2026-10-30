import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Request, Response } from "express"
import { IDENTITY_AUTH_OPTIONS } from "./identity-auth.decorators"
import { IdentityRefreshCookieService } from "./refresh-cookie.service"

const TOKENS = {
    accessToken: "jwt",
    accessExpiresAt: "2026-11-09T10:15:00.000Z",
    accessExpiresIn: 900,
    cookieToken: "r1",
    refreshMaxAgeSeconds: 60,
    user: { id: "u1", email: "an@example.test" },
}

const build = async (cookieDomain: string | undefined) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentityRefreshCookieService,
            {
                provide: IDENTITY_AUTH_OPTIONS,
                useValue: {
                    webOrigin: "https://app.nivo.vn",
                    cookieDomain,
                    refreshTtlSeconds: 3600,
                    resetTtlSeconds: 3600,
                    inviteTtlSeconds: 3600,
                    loginAttempts: 5,
                    resetAttempts: 5,
                    attemptWindowMs: 60_000,
                },
            },
        ],
    }).compile()
    return moduleRef.get(IdentityRefreshCookieService)
}

describe("IdentityRefreshCookieService / issue and clear", () => {
    const SHARED = { httpOnly: true, secure: true, sameSite: "lax", domain: ".nivo.vn" } as const
    const HOST_ONLY = { httpOnly: true, secure: true, sameSite: "lax" } as const

    it("writes an httpOnly, Secure, SameSite=Lax cookie on every path of the shared domain, clearing the old /auth copy first", async () => {
        const response = mock<Response>()

        ;(await build(".nivo.vn")).issue(response, TOKENS)

        expect(response.clearCookie).toHaveBeenCalledWith("nivo_refresh", { ...SHARED, path: "/auth" })
        expect(response.cookie).toHaveBeenCalledWith("nivo_refresh", "r1", { ...SHARED, path: "/", maxAge: 60_000 })
    })

    it("keeps the cookie host-only when no domain is configured, on write and on clear", async () => {
        const response = mock<Response>()
        const service = await build(undefined)

        service.issue(response, TOKENS)
        service.clear(response)

        expect(response.cookie).toHaveBeenCalledWith("nivo_refresh", "r1", { ...HOST_ONLY, path: "/", maxAge: 60_000 })
        expect(response.clearCookie).toHaveBeenCalledWith("nivo_refresh", { ...HOST_ONLY, path: "/" })
        expect(response.clearCookie).toHaveBeenCalledWith("nivo_refresh", { ...HOST_ONLY, path: "/auth" })
    })

    it("clears the cookie on its path and on the old /auth path, with the attributes it was written with", async () => {
        const response = mock<Response>()

        ;(await build(".nivo.vn")).clear(response)

        expect(response.clearCookie).toHaveBeenCalledWith("nivo_refresh", { ...SHARED, path: "/" })
        expect(response.clearCookie).toHaveBeenCalledWith("nivo_refresh", { ...SHARED, path: "/auth" })
    })
})

describe("IdentityRefreshCookieService / read and deviceOf", () => {
    it("reads the refresh token from the Cookie header, empty when it is absent", async () => {
        const service = await build(undefined)

        expect(service.read(mock<Request>({ headers: { cookie: "a=1; nivo_refresh=tok; b=2" } }))).toBe("tok")
        expect(service.read(mock<Request>({ headers: {} }))).toBe("")
    })

    it("describes the device by a bounded user agent and the caller address", async () => {
        const service = await build(undefined)

        expect(
            service.deviceOf(mock<Request>({ headers: { "user-agent": "x".repeat(600) }, ip: "203.0.113.9" })),
        ).toEqual({
            userAgent: "x".repeat(512),
            ip: "203.0.113.9",
        })
        expect(service.deviceOf(mock<Request>({ headers: {}, ip: undefined }))).toEqual({ userAgent: null, ip: null })
    })
})
