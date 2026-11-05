import { createHmac } from "node:crypto"
import { Test } from "@nestjs/testing"
import { signRunToken, toolFingerprintOf, verifyRunToken } from "./node-run-token.policy"
import type { NodeRunClaims } from "./node-run-token.contracts"

/** The members of the subject under test. */
interface Subject {
    readonly signRunToken: typeof signRunToken
    readonly toolFingerprintOf: typeof toolFingerprintOf
    readonly verifyRunToken: typeof verifyRunToken
}

const SUBJECT = Symbol("node-run-token.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { signRunToken, toolFingerprintOf, verifyRunToken } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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
    it("answers the claims of a token it signed while it is valid", async () => {
        const subject = await build()
        expect(subject.verifyRunToken(KEY, subject.signRunToken(KEY, CLAIMS), NOW)).toEqual(CLAIMS)
    })

    it("refuses a token signed with another key, an expired one, a changed body and text that is no token", async () => {
        const subject = await build()
        const token = subject.signRunToken(KEY, CLAIMS)
        const [, signature] = token.split(".")
        const forged = `${Buffer.from(JSON.stringify({ ...CLAIMS, origin: "owner" })).toString("base64url")}.${signature ?? ""}`

        expect(subject.verifyRunToken(OTHER_KEY, token, NOW)).toBeNull()
        expect(subject.verifyRunToken(KEY, token, CLAIMS.expiresAt)).toBeNull()
        expect(subject.verifyRunToken(KEY, forged, NOW)).toBeNull()
        expect(subject.verifyRunToken(KEY, "", NOW)).toBeNull()
        expect(subject.verifyRunToken(KEY, "a.b.c", NOW)).toBeNull()
    })

    it("refuses a signed body that is not run claims", async () => {
        const subject = await build()
        const signed = (body: unknown): string => {
            const text = Buffer.from(JSON.stringify(body)).toString("base64url")
            return [text, createHmac("sha256", KEY).update(text).digest("base64url")].join(".")
        }

        expect(subject.verifyRunToken(KEY, signed("claims"), NOW)).toBeNull()
        expect(subject.verifyRunToken(KEY, signed(null), NOW)).toBeNull()
        expect(subject.verifyRunToken(KEY, signed({ workspaceId: "ws-1" }), NOW)).toBeNull()
        expect(subject.verifyRunToken(KEY, signed({ ...CLAIMS, origin: "robot" }), NOW)).toBeNull()
        expect(subject.verifyRunToken(KEY, signed({ ...CLAIMS, conversationId: 5 }), NOW)).toBeNull()
        expect(subject.verifyRunToken(KEY, signed({ ...CLAIMS, memberId: 7 }), NOW)).toBeNull()
        expect(subject.verifyRunToken(KEY, signed(CLAIMS), NOW)).toEqual(CLAIMS)
    })

    it("fingerprints a call by its tool and arguments, whatever order the members came in", async () => {
        const subject = await build()
        const one = subject.toolFingerprintOf("ledger.append", { entry: { a: 1, b: [1, "x"] }, note: null })
        const same = subject.toolFingerprintOf("ledger.append", { note: null, entry: { b: [1, "x"], a: 1 } })

        expect(one).toBe(same)
        expect(one).toMatch(/^[0-9a-f]{64}$/u)
        expect(subject.toolFingerprintOf("ledger.append", { entry: { a: 2, b: [1, "x"] }, note: null })).not.toBe(one)
        expect(subject.toolFingerprintOf("ledger.void", { entry: { a: 1, b: [1, "x"] }, note: null })).not.toBe(one)
    })

    it("fingerprints an argument with no value as a null one", async () => {
        const subject = await build()
        expect(subject.toolFingerprintOf("ledger.append", { note: undefined })).toBe(
            subject.toolFingerprintOf("ledger.append", { note: null }),
        )
    })
})
