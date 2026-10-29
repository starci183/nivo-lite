import type * as SubjectModule from "./zalo-secret.policy"
import { Test } from "@nestjs/testing"
import { hasLiveTokens, parseZaloSecret } from "./zalo-secret.policy"

const SUBJECT = Symbol("zalo-secret.policy")
type Subject = Pick<typeof SubjectModule, "parseZaloSecret" | "hasLiveTokens">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parseZaloSecret, hasLiveTokens } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = Date.parse("2026-10-12T00:00:00.000Z")

const base = { appId: "1", appSecret: "s", oaSecret: "" }

describe("parseZaloSecret", () => {
    it("reads the app keys and keeps the tokens and a pending authorization", async () => {
        const subject = await buildSubject()

        const secret = subject.parseZaloSecret(
            JSON.stringify({
                appId: "1",
                appSecret: "s",
                oaSecret: "o",
                accessToken: "at",
                refreshToken: "rt",
                refreshExpiresAt: "2027-01-01T00:00:00.000Z",
                pkce: { verifier: "v", nonce: "n", exp: 5 },
            }),
        )

        expect(secret).toEqual({
            appId: "1",
            appSecret: "s",
            oaSecret: "o",
            accessToken: "at",
            renewalToken: "rt",
            refreshExpiresAt: "2027-01-01T00:00:00.000Z",
            pkce: { verifier: "v", nonce: "n", exp: 5 },
        })
    })

    it("reads the renewal token from either the current or the legacy stored key", async () => {
        const subject = await buildSubject()
        const stored = (key: string) => JSON.stringify({ appId: "1", appSecret: "s", [key]: "rt" })

        expect(subject.parseZaloSecret(stored("renewalToken"))).toMatchObject({ renewalToken: "rt" })
        expect(subject.parseZaloSecret(stored("refreshToken"))).toMatchObject({ renewalToken: "rt" })
    })

    it("defaults a missing OA secret to blank and drops malformed optional parts", async () => {
        const subject = await buildSubject()

        expect(
            subject.parseZaloSecret(
                JSON.stringify({ appId: "1", appSecret: "s", pkce: { verifier: "v" }, accessToken: 3 }),
            ),
        ).toEqual({
            appId: "1",
            appSecret: "s",
            oaSecret: "",
        })
        expect(subject.parseZaloSecret(JSON.stringify({ appId: "1", appSecret: "s", pkce: "x" }))).toEqual({
            appId: "1",
            appSecret: "s",
            oaSecret: "",
        })
    })

    it("answers null for text that is not a Zalo credential", async () => {
        const subject = await buildSubject()

        expect(subject.parseZaloSecret("not json")).toBeNull()
        expect(subject.parseZaloSecret("null")).toBeNull()
        expect(subject.parseZaloSecret("[1]")).toBeNull()
        expect(subject.parseZaloSecret(JSON.stringify({ appId: 1, appSecret: "s" }))).toBeNull()
        expect(subject.parseZaloSecret(JSON.stringify({ appId: "1" }))).toBeNull()
    })
})

describe("hasLiveTokens", () => {
    it("needs a refresh token that has not expired", async () => {
        const subject = await buildSubject()

        expect(subject.hasLiveTokens(base, NOW)).toBe(false)
        expect(subject.hasLiveTokens({ ...base, renewalToken: "rt" }, NOW)).toBe(true)
        expect(
            subject.hasLiveTokens({ ...base, renewalToken: "rt", refreshExpiresAt: "2027-01-01T00:00:00.000Z" }, NOW),
        ).toBe(true)
        expect(
            subject.hasLiveTokens({ ...base, renewalToken: "rt", refreshExpiresAt: "2026-01-01T00:00:00.000Z" }, NOW),
        ).toBe(false)
        expect(subject.hasLiveTokens({ ...base, renewalToken: "rt", refreshExpiresAt: "garbage" }, NOW)).toBe(true)
    })
})
