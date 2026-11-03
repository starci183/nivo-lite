import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Request, Response } from "express"
import { AUTH_ERROR_CODES, AuthError, PASSPORT_DOORS, PASSPORT_SESSIONS } from "@modules/integrations/passport"
import type { AuthDoors, AuthSessions, HttpExchange } from "@modules/integrations/passport"
import type { Principal } from "@modules/platform/cqrs"
import { IdentityError } from "./errors/identity.error"
import { IdentitySignInService } from "./sign-in.service"

const GRANT = {
    accessToken: "jwt",
    expiresIn: 900,
    expiresAt: "2026-11-09T10:15:00.000Z",
    user: { id: "u1", email: "an@example.test" },
}
const REDIRECT = { url: "https://app.example.test/inbox", statusCode: 303 }

const build = async () => {
    const doors = mock<AuthDoors>()
    const sessions = mock<AuthSessions>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentitySignInService,
            { provide: PASSPORT_DOORS, useValue: doors },
            { provide: PASSPORT_SESSIONS, useValue: sessions },
        ],
    }).compile()
    const exchange: HttpExchange = { req: mock<Request>(), res: mock<Response>() }
    return { service: moduleRef.get(IdentitySignInService), doors, sessions, exchange }
}

describe("IdentitySignInService / doors", () => {
    it("hands each cookie door to the package and answers what it answers", async () => {
        const { service, doors, exchange } = await build()
        doors.login.mockResolvedValue(GRANT)
        doors.refresh.mockResolvedValue(GRANT)
        doors.session.mockResolvedValue(GRANT)
        doors.logout.mockResolvedValue(undefined)
        doors.beginGoogle.mockResolvedValue(undefined)
        doors.completeGoogle.mockResolvedValue(REDIRECT)

        await expect(service.login(exchange)).resolves.toEqual(GRANT)
        await expect(service.refresh(exchange)).resolves.toEqual(GRANT)
        await expect(service.session(exchange)).resolves.toEqual(GRANT)
        await expect(service.logout(exchange)).resolves.toBeUndefined()
        await expect(service.beginGoogle(exchange)).resolves.toBeUndefined()
        await expect(service.completeGoogle(exchange)).resolves.toEqual(REDIRECT)

        for (const door of [
            doors.login,
            doors.refresh,
            doors.session,
            doors.logout,
            doors.beginGoogle,
            doors.completeGoogle,
        ]) {
            expect(door).toHaveBeenCalledWith(exchange)
        }
    })

    it("turns a refusal of the package into the identity error the errors filter maps", async () => {
        const { service, doors, exchange } = await build()
        doors.refresh.mockRejectedValue(new AuthError(AUTH_ERROR_CODES.RefreshReused))

        const refusal: unknown = await service.refresh(exchange).catch((cause: unknown) => cause)

        expect(refusal).toBeInstanceOf(IdentityError)
        expect(refusal).toMatchObject({ code: "IDENTITY_REFRESH_REUSED" })
    })

    it("lets the domain refusal of a sign-in decision through as it is", async () => {
        const { service, doors, exchange } = await build()
        const refusal = new Error("identity refused")
        doors.login.mockRejectedValue(refusal)

        await expect(service.login(exchange)).rejects.toBe(refusal)
    })
})

describe("IdentitySignInService / keys and other devices", () => {
    const principal: Principal = { id: "u1", role: "authenticated", sessionId: "s1" }

    it("answers the public key document of the package", async () => {
        const { service, sessions } = await build()
        sessions.jwks.mockResolvedValue({ keys: [{ kid: "k1" }] })

        await expect(service.jwks()).resolves.toEqual({ keys: [{ kid: "k1" }] })
    })

    it("signs the caller out of every other device but the session of the token", async () => {
        const { service, sessions } = await build()
        sessions.endOthers.mockResolvedValue(undefined)

        await service.endOthers(principal)

        expect(sessions.endOthers).toHaveBeenCalledWith("u1", "s1")
    })

    it("refuses with the passport error when the token names no session", async () => {
        const { service, sessions } = await build()
        sessions.endOthers.mockRejectedValue(new AuthError(AUTH_ERROR_CODES.Unauthenticated))

        await expect(service.endOthers({ id: "u1", role: "authenticated" })).rejects.toMatchObject({
            code: "IDENTITY_UNAUTHENTICATED",
        })
    })
})
