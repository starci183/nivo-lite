import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Request, Response } from "express"
import { PASSPORT_FLOWS } from "@modules/integrations/passport"
import type { HttpExchange, PassportFlowsService } from "@modules/integrations/passport"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { IDENTITY_AUTH_OPTIONS } from "./identity-auth.decorators"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { IdentityRefreshCookieService } from "./refresh-cookie.service"
import { IdentitySessionsService } from "./sessions.service"
import { IdentitySignInService } from "./sign-in.service"

const SUBJECT = { userId: "u1", email: "an@example.test" }
const DEVICE = { userAgent: "Mozilla", ip: "203.0.113.9" }
const OPTIONS: IdentityAuthOptions = {
    webOrigin: "https://app.example.test",
    cookieDomain: undefined,
    refreshTtlSeconds: 3600,
    resetTtlSeconds: 3600,
    inviteTtlSeconds: 3600,
    loginAttempts: 5,
    resetAttempts: 5,
    attemptWindowMs: 60_000,
}
const TOKENS = {
    accessToken: "jwt",
    accessExpiresAt: "2026-11-09T10:15:00.000Z",
    accessExpiresIn: 900,
    cookieToken: "refresh",
    refreshMaxAgeSeconds: 3600,
    user: { id: "u1", email: "an@example.test" },
}
const GRANT = {
    accessToken: "jwt",
    expiresIn: 900,
    expiresAt: "2026-11-09T10:15:00.000Z",
    user: { id: "u1", email: "an@example.test" },
}

const build = async () => {
    const flows = mock<PassportFlowsService>()
    const sessions = mock<IdentitySessionsService>()
    sessions.start.mockResolvedValue(TOKENS)
    sessions.refresh.mockResolvedValue(TOKENS)
    sessions.access.mockResolvedValue(TOKENS)
    const cookies = mock<IdentityRefreshCookieService>()
    cookies.read.mockReturnValue("cookie-token")
    cookies.deviceOf.mockReturnValue(DEVICE)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentitySignInService,
            { provide: PASSPORT_FLOWS, useValue: flows },
            { provide: IdentitySessionsService, useValue: sessions },
            { provide: IdentityRefreshCookieService, useValue: cookies },
            { provide: IDENTITY_AUTH_OPTIONS, useValue: OPTIONS },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    const exchange: HttpExchange = { req: mock<Request>(), res: mock<Response>() }
    return { service: moduleRef.get(IdentitySignInService), flows, sessions, cookies, logger, exchange }
}

describe("IdentitySignInService / login", () => {
    it("opens the session of the person the local strategy established and sets the cookie, not the body", async () => {
        const { service, flows, sessions, cookies, exchange } = await build()
        flows.authenticateLocal.mockResolvedValue(SUBJECT)

        await expect(service.login(exchange)).resolves.toEqual(GRANT)

        expect(sessions.start).toHaveBeenCalledWith(SUBJECT, DEVICE)
        expect(cookies.issue).toHaveBeenCalledWith(exchange.res, TOKENS)
    })

    it("opens no session and sets no cookie when the strategy refuses", async () => {
        const { service, flows, sessions, cookies, exchange } = await build()
        flows.authenticateLocal.mockRejectedValue(new Error("refused"))

        await expect(service.login(exchange)).rejects.toThrow("refused")

        expect(sessions.start).not.toHaveBeenCalled()
        expect(cookies.issue).not.toHaveBeenCalled()
    })
})

describe("IdentitySignInService / refresh, session and logout", () => {
    it("rotates the cookie token and sets the new cookie", async () => {
        const { service, sessions, cookies, exchange } = await build()

        await expect(service.refresh(exchange)).resolves.toEqual(GRANT)

        expect(sessions.refresh).toHaveBeenCalledWith("cookie-token")
        expect(cookies.issue).toHaveBeenCalledWith(exchange.res, TOKENS)
    })

    it("leaves the cookie as the sibling wrote it when the token was just rotated by a racing request", async () => {
        const { service, sessions, cookies, exchange } = await build()
        sessions.refresh.mockResolvedValue({ ...TOKENS, cookieKept: true })

        await expect(service.refresh(exchange)).resolves.toEqual(GRANT)

        expect(cookies.issue).not.toHaveBeenCalled()
        expect(cookies.clear).not.toHaveBeenCalled()
    })

    it("clears the cookie and rethrows when the token cannot be used", async () => {
        const { service, sessions, cookies, exchange } = await build()
        const refusal = new IdentityError({ code: IdentityErrorCode.RefreshReused })
        sessions.refresh.mockRejectedValue(refusal)

        await expect(service.refresh(exchange)).rejects.toBe(refusal)

        expect(cookies.clear).toHaveBeenCalledWith(exchange.res)
        expect(cookies.issue).not.toHaveBeenCalled()
    })

    it("answers an access token for the cookie session without touching the cookie", async () => {
        const { service, sessions, cookies, exchange } = await build()

        await expect(service.session(exchange)).resolves.toEqual(GRANT)

        expect(sessions.access).toHaveBeenCalledWith("cookie-token")
        expect(cookies.issue).not.toHaveBeenCalled()
        expect(cookies.clear).not.toHaveBeenCalled()
    })

    it("ends the session of the cookie and clears it", async () => {
        const { service, sessions, cookies, exchange } = await build()

        await service.logout(exchange)

        expect(sessions.end).toHaveBeenCalledWith("cookie-token")
        expect(cookies.clear).toHaveBeenCalledWith(exchange.res)
    })
})

describe("IdentitySignInService / google", () => {
    it("hands the start of the round trip to the strategy", async () => {
        const { service, flows, exchange } = await build()
        flows.beginGoogle.mockResolvedValue(undefined)

        await service.beginGoogle(exchange)

        expect(flows.beginGoogle).toHaveBeenCalledWith(exchange)
    })

    it("signs in the person a finished round trip established, sets the cookie and sends the browser to the web app", async () => {
        const { service, flows, sessions, cookies, exchange } = await build()
        flows.completeGoogle.mockResolvedValue({ subject: SUBJECT, next: "/inbox" })

        await expect(service.completeGoogle(exchange)).resolves.toEqual({
            url: "https://app.example.test/inbox",
            statusCode: 303,
        })

        expect(sessions.start).toHaveBeenCalledWith(SUBJECT, DEVICE)
        expect(cookies.issue).toHaveBeenCalledWith(exchange.res, TOKENS)
    })

    it("sends the browser back to sign in, with no session, when the round trip fails", async () => {
        const { service, flows, sessions, cookies, logger, exchange } = await build()
        flows.completeGoogle.mockRejectedValue(new Error("state mismatch"))

        await expect(service.completeGoogle(exchange)).resolves.toEqual({
            url: "https://app.example.test/sign-in?auth=error",
            statusCode: 303,
        })

        expect(sessions.start).not.toHaveBeenCalled()
        expect(cookies.clear).toHaveBeenCalledWith(exchange.res)
        expect(logger.error).toHaveBeenCalledTimes(1)
    })
})
