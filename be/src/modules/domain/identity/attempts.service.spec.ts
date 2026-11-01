import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { RATE_LIMIT_STORE } from "@modules/platform/database"
import type { RateLimitStore } from "@modules/platform/database"
import { IdentityAttemptsService } from "./attempts.service"
import { IdentityErrorCode } from "./errors/identity.error"
import { IDENTITY_AUTH_OPTIONS } from "./identity-auth.decorators"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { digestOf } from "./password.policy"

const OPTIONS: IdentityAuthOptions = {
    webOrigin: "https://app.example.test",
    cookieDomain: undefined,
    refreshTtlSeconds: 3600,
    resetTtlSeconds: 3600,
    inviteTtlSeconds: 3600,
    loginAttempts: 10,
    resetAttempts: 5,
    attemptWindowMs: 900_000,
}

const build = async (allowed: boolean) => {
    const limits = mock<RateLimitStore>()
    limits.consume.mockResolvedValue(allowed)
    limits.clear.mockResolvedValue()
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentityAttemptsService,
            { provide: RATE_LIMIT_STORE, useValue: limits },
            { provide: IDENTITY_AUTH_OPTIONS, useValue: OPTIONS },
        ],
    }).compile()
    return { service: moduleRef.get(IdentityAttemptsService), limits }
}

describe("IdentityAttemptsService", () => {
    it("counts a login attempt against the hashed address with the login limit", async () => {
        const { service, limits } = await build(true)

        await expect(service.admit("login", "an@example.test")).resolves.toBeUndefined()

        expect(limits.consume).toHaveBeenCalledWith(`login:${digestOf("an@example.test")}`, 900_000, 10)
    })

    it.each(["reset", "signup"] as const)("counts a %s attempt with the reset limit", async (kind) => {
        const { service, limits } = await build(true)

        await service.admit(kind, "an@example.test")

        expect(limits.consume).toHaveBeenCalledWith(`${kind}:${digestOf("an@example.test")}`, 900_000, 5)
    })

    it("refuses an address that is over its limit", async () => {
        const { service } = await build(false)

        await expect(service.admit("login", "an@example.test")).rejects.toMatchObject({
            code: IdentityErrorCode.TooManyAttempts,
        })
    })

    it("clears the counter of the hashed address and kind", async () => {
        const { service, limits } = await build(true)

        await expect(service.clear("login", "an@example.test")).resolves.toBeUndefined()

        expect(limits.clear.mock.calls).toEqual([[`login:${digestOf("an@example.test")}`]])
    })
})
