import { createHmac } from "node:crypto"
import { signRunToken, toolFingerprintOf, verifyRunToken } from "./node-run-token.policy"
import type { NodeRunClaims } from "./node-run-token.contracts"

const KEY = Buffer.alloc(32, 7)
const OTHER_KEY = Buffer.alloc(32, 9)
const NOW = 1_000_000

const CLAIMS: NodeRunClaims = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    runId: "run-1",
    conversationId: "conv-1",
    origin: "customer",
    memberId: null,
    scope: "public",
    expiresAt: NOW + 60_000,
}

describe("run token policy", () => {
    it("answers the claims of a token it signed while it is valid", () => {
        expect(verifyRunToken(KEY, signRunToken(KEY, CLAIMS), NOW)).toEqual(CLAIMS)
    })

    it("refuses a token signed with another key, an expired one, a changed body and text that is no token", () => {
        const token = signRunToken(KEY, CLAIMS)
        const [, signature] = token.split(".")
        const forged = `${Buffer.from(JSON.stringify({ ...CLAIMS, origin: "owner" })).toString("base64url")}.${signature ?? ""}`

        expect(verifyRunToken(OTHER_KEY, token, NOW)).toBeNull()
        expect(verifyRunToken(KEY, token, CLAIMS.expiresAt)).toBeNull()
        expect(verifyRunToken(KEY, forged, NOW)).toBeNull()
        expect(verifyRunToken(KEY, "", NOW)).toBeNull()
        expect(verifyRunToken(KEY, "a.b.c", NOW)).toBeNull()
    })

    it("refuses a signed body that is not run claims", () => {
        const signed = (body: object): string => {
            const text = Buffer.from(JSON.stringify(body)).toString("base64url")
            return [text, createHmac("sha256", KEY).update(text).digest("base64url")].join(".")
        }

        expect(verifyRunToken(KEY, signed({ workspaceId: "ws-1" }), NOW)).toBeNull()
        expect(verifyRunToken(KEY, signed({ ...CLAIMS, origin: "robot" }), NOW)).toBeNull()
        expect(verifyRunToken(KEY, signed(CLAIMS), NOW)).toEqual(CLAIMS)
    })

    it("fingerprints a call by its tool and arguments, whatever order the members came in", () => {
        const one = toolFingerprintOf("ledger.append", { entry: { a: 1, b: [1, "x"] }, note: null })
        const same = toolFingerprintOf("ledger.append", { note: null, entry: { b: [1, "x"], a: 1 } })

        expect(one).toBe(same)
        expect(one).toMatch(/^[0-9a-f]{64}$/u)
        expect(toolFingerprintOf("ledger.append", { entry: { a: 2, b: [1, "x"] }, note: null })).not.toBe(one)
        expect(toolFingerprintOf("ledger.void", { entry: { a: 1, b: [1, "x"] }, note: null })).not.toBe(one)
    })
})
