import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    AuthDoors,
    AuthFlows,
    AuthPrincipalVerifier,
    AuthSessions,
    AuthTokens,
    RefreshCookie,
} from "@starci/auth/server"
import type { AuthLogger, HttpExchange } from "@starci/auth/server"
import {
    FakeClock,
    MemoryAccounts,
    MemoryRateCounter,
    MemorySessionStore,
    generateTestKeyPair,
    sequentialIds,
} from "@starci/auth/testing"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import {
    DEFAULT_ISSUER,
    DEFAULT_REFRESH_TTL_SECONDS,
    REFRESH_COOKIE_LEGACY_PATHS,
    REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_PATH,
} from "./passport.config"
import { passportKit } from "./passport.kit"
import type { PassportOptions } from "./passport.options"

/**
 * The kit joins the typed settings with the stores. The rest of this spec is the compatibility proof: the access tokens and the
 * refresh cookies the Nivo code issued before @starci/auth (written out here as that code made them: the EdDSA token with the
 * header `alg`, `kid`, `typ` and the claims `role`, `session_id`, `email`, `sub`, `iss`, `aud`, `iat`, `exp`; the refresh token
 * as two ids without dashes, stored by its sha256 hex, carried by the cookie `nivo_refresh`) must verify and rotate under the
 * package, built from the settings the app parses.
 */
const KIT: unique symbol = Symbol("passport.kit")
const NOW = new Date("2026-11-09T10:00:00.000Z")
const DAY_MS = 86_400_000
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "an@example.test" }
const SESSION = "22222222-2222-4222-8222-222222222222"
const OLD_REFRESH_TOKEN = "33333333333343338333333333333333".concat("44444444444444448444444444444444")

const pair = generateTestKeyPair()

const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString("base64url")

const decode = (part: string | undefined): Record<string, unknown> => {
    const read = parseJsonText(Buffer.from(part ?? "", "base64url").toString("utf8"))
    return read.ok && isRecord(read.value) ? Object.fromEntries(Object.entries(read.value)) : {}
}

/** The `kid` the old code derived when no key id was configured: the RFC 7638 thumbprint of the public key. */
const thumbprintOf = (publicPem: string): string => {
    const { crv, kty, x } = createPublicKey(publicPem).export({ format: "jwk" })
    return createHash("sha256").update(JSON.stringify({ crv, kty, x })).digest("base64url")
}

interface OldTokenShape {
    readonly kid: string
    readonly issuer?: string
    readonly expiresInSeconds?: number
}

/** An access token as the old signer made it. */
const oldAccessToken = ({ kid, issuer = "nivo-lite", expiresInSeconds = 900 }: OldTokenShape): string => {
    const issuedAt = Math.floor(NOW.getTime() / 1000)
    const head = encode({ alg: "EdDSA", kid, typ: "JWT" })
    const body = encode({
        role: "authenticated",
        session_id: SESSION,
        email: USER.email,
        sub: USER.id,
        iss: issuer,
        aud: "authenticated",
        iat: issuedAt,
        exp: issuedAt + expiresInSeconds,
    })
    const signature = sign(null, Buffer.from(`${head}.${body}`), createPrivateKey(pair.privateKey)).toString(
        "base64url",
    )
    return `${head}.${body}.${signature}`
}

/** The settings the app parses for a deployment with this key (and key id), with the cookie and issuer live sessions carry. */
const settings = (keyId: string | undefined): PassportOptions => ({
    issuer: DEFAULT_ISSUER,
    audience: "authenticated",
    keys: [{ privateKey: pair.privateKey, publicKey: pair.publicKey, keyId }],
    accessTtlSeconds: 900,
    refreshTtlSeconds: DEFAULT_REFRESH_TTL_SECONDS,
    bcryptCost: 4,
    returnOrigin: "https://app.example.test",
    google: null,
    cookie: {
        name: REFRESH_COOKIE_NAME,
        domain: undefined,
        path: REFRESH_COOKIE_PATH,
        legacyPaths: REFRESH_COOKIE_LEGACY_PATHS,
        sameSite: "lax",
    },
    budget: { loginAttempts: 10, resetAttempts: 5, windowMs: 900_000 },
})

/** The package as the app builds it from its settings, over in-memory stores and a clock the spec moves. */
const world = async (keyId?: string) => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: KIT, useValue: { passportKit } }],
    }).compile()
    const create = moduleRef.get<{ passportKit: typeof passportKit }>(KIT).passportKit
    const clock = new FakeClock(NOW)
    const sessions = new MemorySessionStore()
    const options = create(settings(keyId), {
        sessions,
        accounts: new MemoryAccounts().set({ ...USER, disabled: false }),
        rate: new MemoryRateCounter(clock),
        clock,
        ids: sequentialIds(),
        logger: mock<AuthLogger>(),
    })
    const tokens = new AuthTokens(options)
    const authSessions = new AuthSessions({ options, tokens, clock, ids: sequentialIds() })
    const doors = new AuthDoors({
        flows: new AuthFlows(options),
        sessions: authSessions,
        cookie: new RefreshCookie(options.cookie),
        returnOrigin: options.returnOrigin,
    })
    return { clock, sessions, options, doors, verifier: new AuthPrincipalVerifier(tokens, clock) }
}

const requestWith = (cookie: string) => {
    const res = mock<HttpExchange["res"]>()
    const exchange: HttpExchange = {
        req: { headers: { cookie, "user-agent": "Mozilla" }, ip: "203.0.113.9" },
        res,
    }
    return { exchange, written: res.cookie, cleared: res.clearCookie }
}

const seedOldSession = (sessions: MemorySessionStore): void => {
    sessions.sessions.set(SESSION, { id: SESSION, userId: USER.id, now: NOW, userAgent: "Mozilla", ip: null })
    sessions.tokens.set("old-row", {
        id: "old-row",
        sessionId: SESSION,
        userId: USER.id,
        tokenHash: createHash("sha256").update(OLD_REFRESH_TOKEN, "utf8").digest("hex"),
        expiresAt: new Date(NOW.getTime() + DAY_MS),
        usedAt: null,
        racedCount: 0,
    })
}

describe("passportKit", () => {
    it("joins the typed settings with the stores, clock, ids and logger of the app", async () => {
        const { options } = await world("nivo-key-1")

        expect(options).toMatchObject({
            issuer: "nivo-lite",
            audience: "authenticated",
            accessTtlSeconds: 900,
            refreshTtlSeconds: 2_592_000,
            returnOrigin: "https://app.example.test",
            cookie: { name: "nivo_refresh", path: "/", legacyPaths: ["/auth"], sameSite: "lax" },
        })
        expect(options.keys).toHaveLength(1)
        expect(options.keys[0]?.keyId).toBe("nivo-key-1")
        expect(options.sessions).toBeInstanceOf(MemorySessionStore)
    })
})

describe("sessions issued before @starci/auth / access token", () => {
    it("verifies an access token signed under a configured key id", async () => {
        const { verifier } = await world("nivo-key-1")

        await expect(verifier.verify(oldAccessToken({ kid: "nivo-key-1" }), NOW)).resolves.toEqual({
            kind: "ok",
            value: { id: USER.id, role: "authenticated", sessionId: SESSION, email: USER.email },
        })
    })

    it("verifies an access token signed under the thumbprint derived when no key id was configured", async () => {
        const { verifier } = await world()

        await expect(
            verifier.verify(oldAccessToken({ kid: thumbprintOf(pair.publicKey) }), NOW),
        ).resolves.toMatchObject({
            kind: "ok",
            value: { id: USER.id, sessionId: SESSION },
        })
    })

    it("refuses what the old code refused: another issuer, an expired token, a key id of no key", async () => {
        const { verifier } = await world("nivo-key-1")

        const refusals = await Promise.all(
            [
                oldAccessToken({ kid: "nivo-key-1", issuer: "someone-else" }),
                oldAccessToken({ kid: "nivo-key-1", expiresInSeconds: -1 }),
                oldAccessToken({ kid: "another-key" }),
            ].map((token) => verifier.verify(token, NOW)),
        )

        expect(refusals.map((outcome) => outcome.kind)).toEqual(["refused", "refused", "refused"])
    })
})

describe("sessions issued before @starci/auth / refresh cookie", () => {
    it("rotates the cookie of the old code: same name and flags, a new token, an access token of the same shape", async () => {
        const { doors, sessions, verifier } = await world("nivo-key-1")
        seedOldSession(sessions)
        const { exchange, written, cleared } = requestWith(`theme=dark; nivo_refresh=${OLD_REFRESH_TOKEN}`)

        const grant = await doors.refresh(exchange)

        expect(grant.user).toEqual(USER)
        expect(written).toHaveBeenCalledTimes(1)
        expect(written).toHaveBeenCalledWith("nivo_refresh", expect.stringMatching(/^[a-z0-9]{16,}$/u), {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 2_592_000_000,
        })
        expect(written).not.toHaveBeenCalledWith("nivo_refresh", OLD_REFRESH_TOKEN, expect.anything())
        expect(cleared).toHaveBeenCalledWith("nivo_refresh", expect.objectContaining({ path: "/auth" }))
        expect(sessions.tokens.get("old-row")?.usedAt).toEqual(NOW)

        const [head, body] = grant.accessToken.split(".")
        expect(decode(head)).toEqual({ alg: "EdDSA", kid: "nivo-key-1", typ: "JWT" })
        expect(Object.keys(decode(body)).sort((a, b) => a.localeCompare(b))).toEqual(
            ["aud", "email", "exp", "iat", "iss", "role", "session_id", "sub"].sort((a, b) => a.localeCompare(b)),
        )
        expect(decode(body)).toMatchObject({
            iss: "nivo-lite",
            aud: "authenticated",
            role: "authenticated",
            session_id: SESSION,
        })
        await expect(verifier.verify(grant.accessToken, NOW)).resolves.toMatchObject({ kind: "ok" })
    })

    it("answers a fresh access token for the old cookie without rotating it, and ends the session at sign-out", async () => {
        const { doors, sessions } = await world()
        seedOldSession(sessions)

        const read = requestWith(`nivo_refresh=${OLD_REFRESH_TOKEN}`)
        await expect(doors.session(read.exchange)).resolves.toMatchObject({ user: USER })
        expect(read.written).not.toHaveBeenCalled()
        expect(sessions.tokens.get("old-row")?.usedAt).toBeNull()

        const out = requestWith(`nivo_refresh=${OLD_REFRESH_TOKEN}`)
        await doors.logout(out.exchange)
        expect(sessions.sessions.has(SESSION)).toBe(false)
        expect(out.cleared).toHaveBeenCalledWith("nivo_refresh", expect.objectContaining({ path: "/" }))
    })

    it("ends the session when the old token is replayed after its grace window", async () => {
        const { doors, sessions, clock } = await world()
        seedOldSession(sessions)
        await doors.refresh(requestWith(`nivo_refresh=${OLD_REFRESH_TOKEN}`).exchange)

        clock.advance(60_000)

        await expect(doors.refresh(requestWith(`nivo_refresh=${OLD_REFRESH_TOKEN}`).exchange)).rejects.toMatchObject({
            code: "IDENTITY_REFRESH_REUSED",
        })
        expect(sessions.sessions.has(SESSION)).toBe(false)
    })
})
