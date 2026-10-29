import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PASSPORT_TOKENS } from "@modules/integrations/passport"
import type { PassportTokensClient } from "@modules/integrations/passport"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IdentityErrorCode } from "./errors/identity.error"
import { IDENTITY_AUTH_OPTIONS } from "./identity-auth.decorators"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { digestOf } from "./password.policy"
import { IdentityRefreshTokenEntity } from "./persistence/entities"
import { IdentitySessionsService } from "./sessions.service"

/** The statements `callDbFunction` sends for the session doors. */
const OPEN_SESSION = "SELECT * FROM public.be_auth_open_session($1, $2, $3, $4, $5)"
const TOUCH_SESSION = "SELECT * FROM public.be_auth_touch_session($1, $2)"
const CLOSE_SESSION = "SELECT * FROM public.be_auth_close_session($1)"
const CLOSE_OTHER_SESSIONS = "SELECT * FROM public.be_auth_close_other_sessions($1, $2)"
const USER_BY_ID = "SELECT * FROM public.be_auth_user_by_id($1)"

const NOW = "2026-11-09T10:00:00.000Z"
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
const SUBJECT = { userId: "u1", email: "an@example.test" }
const DEVICE = { userAgent: "Mozilla", ip: "203.0.113.9" }

const tokenRow = (usedAt: string | null, expiresAt = "2026-11-09T11:00:00.000Z") =>
    builder<IdentityRefreshTokenEntity>({
        id: "t1",
        sessionId: "s1",
        userId: "u1",
        tokenHash: "hash",
        createdAt: new Date("2026-11-09T08:00:00.000Z"),
        expiresAt: new Date(expiresAt),
        usedAt: usedAt === null ? null : new Date(usedAt),
    })()

const person = (disabled = false) => [{ id: "u1", email: "an@example.test", last_sign_in_at: null, meta: {}, disabled }]

type QueryStubs = ReadonlyArray<readonly [string, unknown]>

const build = async (stubs: QueryStubs, token: IdentityRefreshTokenEntity | null = null) => {
    const em: MockEntityManager = mockEntityManager({
        query: stubs,
        findOne: [IdentityRefreshTokenEntity, token],
        insert: [IdentityRefreshTokenEntity, {}],
        update: [IdentityRefreshTokenEntity, { affected: 1 }],
        delete: [IdentityRefreshTokenEntity, { affected: 0 }],
    })
    const transaction = fakeTransaction(em)
    const tokens = mock<PassportTokensClient>()
    tokens.sign.mockResolvedValue({ token: "access.jwt", expiresAt: new Date("2026-11-09T10:15:00.000Z") })
    const ids = fakeIds()
    const clock = new FakeClock(NOW)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentitySessionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: PASSPORT_TOKENS, useValue: tokens },
            { provide: CLOCK, useValue: clock },
            { provide: IDS, useValue: ids },
            { provide: IDENTITY_AUTH_OPTIONS, useValue: OPTIONS },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(IdentitySessionsService), em, transaction, tokens, logger, clock }
}

describe("IdentitySessionsService / start", () => {
    it("opens the device session, stores only the hash of the refresh token and answers the first pair", async () => {
        const { service, em, tokens } = await build([[OPEN_SESSION, []]])

        const session = await service.start(SUBJECT, DEVICE)

        expect(session).toMatchObject({
            accessToken: "access.jwt",
            accessExpiresAt: "2026-11-09T10:15:00.000Z",
            refreshMaxAgeSeconds: 3600,
            user: { id: "u1", email: "an@example.test" },
        })
        expect(em.insert).toHaveBeenCalledWith(
            IdentityRefreshTokenEntity,
            expect.objectContaining({ tokenHash: digestOf(session.cookieToken), userId: "u1" }),
        )
        expect(em.insert.mock.calls[0]?.[1]).not.toMatchObject({ tokenHash: session.cookieToken })
        expect(tokens.sign).toHaveBeenCalledWith(
            { sub: "u1", email: "an@example.test", sessionId: "00000000-0000-4000-8000-000000000001" },
            new Date(NOW),
        )
    })
})

describe("IdentitySessionsService / refresh", () => {
    const rotation = (): QueryStubs => [
        [USER_BY_ID, person()],
        [TOUCH_SESSION, [{ be_auth_touch_session: true }]],
    ]

    it("rotates: spends the presented token, stores the successor by hash and answers a new pair", async () => {
        const { service, em } = await build(rotation(), tokenRow(null))

        const session = await service.refresh("presented-token")

        expect(session.accessToken).toBe("access.jwt")
        expect(session.cookieToken).not.toBe("presented-token")
        expect(em.findOne).toHaveBeenCalledWith(IdentityRefreshTokenEntity, {
            where: { tokenHash: digestOf("presented-token") },
            lock: { mode: "pessimistic_write" },
        })
        expect(em.update).toHaveBeenCalledWith(IdentityRefreshTokenEntity, { id: "t1" }, { usedAt: new Date(NOW) })
        expect(em.insert).toHaveBeenCalledWith(
            IdentityRefreshTokenEntity,
            expect.objectContaining({ tokenHash: digestOf(session.cookieToken), sessionId: "s1", userId: "u1" }),
        )
        expect(em.delete).toHaveBeenCalledTimes(1)
        expect(em.query).not.toHaveBeenCalledWith(CLOSE_SESSION, expect.anything())
    })

    it("ends the whole session when a rotated token is presented again (reuse detection)", async () => {
        const { service, em, logger } = await build(
            [[CLOSE_SESSION, [{ be_auth_close_session: true }]]],
            tokenRow("2026-11-09T09:00:00.000Z"),
        )

        await expect(service.refresh("stolen-token")).rejects.toMatchObject({ code: IdentityErrorCode.RefreshReused })

        expect(em.query).toHaveBeenCalledWith(CLOSE_SESSION, ["s1"])
        expect(em.update).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledTimes(1)
    })

    it("does not end the session for a racing tab that replays the token within seconds of its rotation", async () => {
        const { service, em } = await build([], tokenRow("2026-11-09T09:59:55.000Z"))

        await expect(service.refresh("raced-token")).rejects.toMatchObject({ code: IdentityErrorCode.RefreshInvalid })

        expect(em.query).not.toHaveBeenCalledWith(CLOSE_SESSION, expect.anything())
    })

    it("refuses an unknown token and an expired one", async () => {
        const unknown = await build([], null)
        await expect(unknown.service.refresh("nope")).rejects.toMatchObject({ code: IdentityErrorCode.RefreshInvalid })

        const expired = await build([], tokenRow(null, "2026-11-09T09:00:00.000Z"))
        await expect(expired.service.refresh("old")).rejects.toMatchObject({ code: IdentityErrorCode.RefreshInvalid })
    })

    it("refuses an empty token without reading anything", async () => {
        const { service, em } = await build([])

        await expect(service.refresh("")).rejects.toMatchObject({ code: IdentityErrorCode.RefreshInvalid })
        expect(em.findOne).not.toHaveBeenCalled()
    })

    it("ends the session of an account that was disabled after sign-in", async () => {
        const { service, em } = await build(
            [
                [USER_BY_ID, person(true)],
                [CLOSE_SESSION, [{ be_auth_close_session: true }]],
            ],
            tokenRow(null),
        )

        await expect(service.refresh("presented-token")).rejects.toMatchObject({
            code: IdentityErrorCode.AccountDisabled,
        })
        expect(em.query).toHaveBeenCalledWith(CLOSE_SESSION, ["s1"])
    })
})

describe("IdentitySessionsService / access", () => {
    it("answers a fresh access token for a live token without rotating or spending it", async () => {
        const { service, em } = await build([[USER_BY_ID, person()]], tokenRow(null))

        const session = await service.access("cookie-token")

        expect(session.accessToken).toBe("access.jwt")
        expect(session.cookieToken).toBe("cookie-token")
        expect(em.update).not.toHaveBeenCalled()
        expect(em.insert).not.toHaveBeenCalled()
    })

    it("still answers for a token a sibling request rotated within the grace window", async () => {
        const { service } = await build([[USER_BY_ID, person()]], tokenRow("2026-11-09T09:59:40.000Z"))

        await expect(service.access("cookie-token")).resolves.toMatchObject({ accessToken: "access.jwt" })
    })

    it("ends the session when a token rotated long ago is replayed", async () => {
        const { service, em } = await build(
            [[CLOSE_SESSION, [{ be_auth_close_session: true }]]],
            tokenRow("2026-11-09T09:00:00.000Z"),
        )

        await expect(service.access("stolen")).rejects.toMatchObject({ code: IdentityErrorCode.RefreshReused })
        expect(em.query).toHaveBeenCalledWith(CLOSE_SESSION, ["s1"])
    })

    it("ends the session of an account that was disabled after sign-in", async () => {
        const { service, em } = await build(
            [
                [USER_BY_ID, person(true)],
                [CLOSE_SESSION, [{ be_auth_close_session: true }]],
            ],
            tokenRow(null),
        )

        await expect(service.access("cookie-token")).rejects.toMatchObject({ code: IdentityErrorCode.AccountDisabled })
        expect(em.query).toHaveBeenCalledWith(CLOSE_SESSION, ["s1"])
    })

    it("refuses an empty, unknown or expired token", async () => {
        await expect((await build([])).service.access("")).rejects.toMatchObject({
            code: IdentityErrorCode.RefreshInvalid,
        })
        const unknown = await build([], null)
        await expect(unknown.service.access("nope")).rejects.toMatchObject({ code: IdentityErrorCode.RefreshInvalid })
        const expired = await build([], tokenRow(null, "2026-11-09T09:00:00.000Z"))
        await expect(expired.service.access("old")).rejects.toMatchObject({ code: IdentityErrorCode.RefreshInvalid })
    })
})

describe("IdentitySessionsService / jwks", () => {
    it("serves the public key document of the token client", async () => {
        const { service, tokens } = await build([])
        tokens.jwks.mockResolvedValue({ keys: [{ kid: "k1", kty: "OKP" }] })

        await expect(service.jwks()).resolves.toEqual({ keys: [{ kid: "k1", kty: "OKP" }] })
    })
})

describe("IdentitySessionsService / endOthers", () => {
    it("signs out every device but the one the caller is on", async () => {
        const { service, em } = await build([[CLOSE_OTHER_SESSIONS, [{ be_auth_close_other_sessions: 2 }]]])

        await service.endOthers({ id: "u1", role: "authenticated", sessionId: "s9" })

        expect(em.query).toHaveBeenCalledWith(CLOSE_OTHER_SESSIONS, ["u1", "s9"])
    })

    it("refuses a caller whose token names no session", async () => {
        const { service } = await build([])

        await expect(service.endOthers({ id: "u1", role: "authenticated" })).rejects.toMatchObject({
            code: IdentityErrorCode.Unauthenticated,
        })
    })
})

describe("IdentitySessionsService / end", () => {
    it("revokes the session of a known refresh token and ignores an unknown one", async () => {
        const known = await build([[CLOSE_SESSION, [{ be_auth_close_session: true }]]], tokenRow(null))
        await known.service.end("cookie-token")
        expect(known.em.query).toHaveBeenCalledWith(CLOSE_SESSION, ["s1"])

        const empty = await build([], tokenRow(null))
        await empty.service.end("")
        expect(empty.em.findOne).not.toHaveBeenCalled()

        const unknown = await build([], null)
        await unknown.service.end("other")
        expect(unknown.em.query).not.toHaveBeenCalledWith(CLOSE_SESSION, expect.anything())
    })
})
