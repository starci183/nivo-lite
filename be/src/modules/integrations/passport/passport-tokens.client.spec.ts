import { generateKeyPairSync } from "node:crypto"
import { SignJWT, importPKCS8 } from "jose"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { PassportErrorCode } from "./errors/passport.error"
import { PASSPORT_OPTIONS } from "./passport.decorators"
import type { PassportOptions } from "./passport.options"
import { PassportTokensClient } from "./passport-tokens.client"

const NOW = new Date("2026-11-09T10:00:00.000Z")

const keyPair = () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519")
    return {
        privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
        publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
    }
}

const build = async (overrides: Partial<PassportOptions> = {}, pair = keyPair()): Promise<PassportTokensClient> => {
    const options: PassportOptions = {
        privateKey: new Secret(pair.privateKey),
        publicKey: pair.publicKey,
        keyId: undefined,
        issuer: "nivo-test",
        returnOrigin: "https://app.example.test",
        audience: "authenticated",
        accessTtlSeconds: 900,
        bcryptCost: 4,
        google: null,
        authenticator: "unused",
        ...overrides,
    }
    const moduleRef = await Test.createTestingModule({
        providers: [PassportTokensClient, { provide: PASSPORT_OPTIONS, useValue: options }],
    }).compile()
    return moduleRef.get(PassportTokensClient)
}

describe("PassportTokensClient / access tokens", () => {
    it("issues a 15 minute token and verifies it back into the claims", async () => {
        const tokens = await build()
        const issued = await tokens.sign({ sub: "u1", email: "an@example.test", sessionId: "s1" }, NOW)

        expect(issued.expiresAt.toISOString()).toBe("2026-11-09T10:15:00.000Z")
        await expect(tokens.verify(issued.token, NOW)).resolves.toEqual({
            kind: "ok",
            value: { sub: "u1", email: "an@example.test", sessionId: "s1" },
        })
    })

    it("verifies a token that carries no email", async () => {
        const tokens = await build()
        const issued = await tokens.sign({ sub: "u1", sessionId: "s1" }, NOW)

        await expect(tokens.verify(issued.token, NOW)).resolves.toEqual({
            kind: "ok",
            value: { sub: "u1", sessionId: "s1" },
        })
    })

    it("refuses an expired token", async () => {
        const tokens = await build()
        const issued = await tokens.sign({ sub: "u1", sessionId: "s1" }, NOW)

        await expect(tokens.verify(issued.token, new Date(NOW.getTime() + 901_000))).resolves.toMatchObject({
            kind: "refused",
            code: PassportErrorCode.AccessTokenInvalid,
        })
    })

    it("refuses a token signed by another key", async () => {
        const forged = await (await build()).sign({ sub: "u1", sessionId: "s1" }, NOW)

        await expect((await build()).verify(forged.token, NOW)).resolves.toMatchObject({ kind: "refused" })
    })

    it("refuses a token of another issuer, a tampered payload and a malformed value", async () => {
        const pair = keyPair()
        const mine = await build({}, pair)
        const foreign = await (await build({ issuer: "somebody-else" }, pair)).sign({ sub: "u1", sessionId: "s1" }, NOW)
        const own = await mine.sign({ sub: "u1", sessionId: "s1" }, NOW)
        const [head, , signature] = own.token.split(".")
        const forgedBody = Buffer.from(JSON.stringify({ sub: "admin", role: "authenticated" })).toString("base64url")

        await expect(mine.verify(foreign.token, NOW)).resolves.toMatchObject({ kind: "refused" })
        await expect(mine.verify(`${head}.${forgedBody}.${signature}`, NOW)).resolves.toMatchObject({ kind: "refused" })
        await expect(mine.verify("not-a-jwt", NOW)).resolves.toMatchObject({ kind: "refused" })
    })

    it.each([
        { claims: { role: "anon", session_id: "s1" }, subject: "u1" },
        { claims: { role: "authenticated" }, subject: "u1" },
        { claims: { role: "authenticated", session_id: "s1" }, subject: undefined },
    ])("refuses a token of our own key that lacks the claims of a session: %p", async ({ claims, subject }) => {
        const pair = keyPair()
        const tokens = await build({}, pair)
        const unsigned = new SignJWT(claims)
            .setProtectedHeader({ alg: "EdDSA" })
            .setIssuer("nivo-test")
            .setAudience("authenticated")
            .setIssuedAt(Math.floor(NOW.getTime() / 1000))
            .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 900)
        const token = await (subject === undefined ? unsigned : unsigned.setSubject(subject)).sign(
            await importPKCS8(pair.privateKey, "EdDSA"),
        )

        await expect(tokens.verify(token, NOW)).resolves.toEqual({
            kind: "refused",
            code: PassportErrorCode.AccessTokenInvalid,
        })
    })
})

describe("PassportTokensClient / jwks", () => {
    it("publishes the public key with its key id and no private part", async () => {
        const document = await (await build({ keyId: "key-1" })).jwks()

        expect(document.keys).toHaveLength(1)
        expect(document.keys[0]).toMatchObject({ kty: "OKP", crv: "Ed25519", alg: "EdDSA", use: "sig", kid: "key-1" })
        expect(document.keys[0]).not.toHaveProperty("d")
    })

    it("derives a stable key id from the key when none is set", async () => {
        const pair = keyPair()
        const first = await (await build({}, pair)).jwks()
        const second = await (await build({}, pair)).jwks()

        expect(first.keys[0]?.kid).toBeTruthy()
        expect(first.keys[0]?.kid).toBe(second.keys[0]?.kid)
    })

    it("fails loudly when the key pair is unusable", async () => {
        await expect((await build({ publicKey: "garbage" })).jwks()).rejects.toMatchObject({
            code: PassportErrorCode.KeyInvalid,
        })
    })
})

describe("PassportTokensClient / state", () => {
    it("round trips a Google state and refuses it once expired or under another key", async () => {
        const tokens = await build()
        const state = { w: "h", u: "v", r: "/a", e: NOW.getTime() + 600_000, p: "google" }
        const signed = tokens.signState(state)

        expect(tokens.verifyState(signed, NOW)).toEqual(state)
        expect(tokens.verifyState(signed, new Date(NOW.getTime() + 601_000))).toBeNull()
        expect((await build()).verifyState(signed, NOW)).toBeNull()
    })

    it("refuses a Google state value as an access token", async () => {
        const tokens = await build()
        const state = tokens.signState({ w: "h", u: "v", r: "/", e: NOW.getTime() + 600_000, p: "google" })

        await expect(tokens.verify(state, NOW)).resolves.toMatchObject({ kind: "refused" })
    })
})
