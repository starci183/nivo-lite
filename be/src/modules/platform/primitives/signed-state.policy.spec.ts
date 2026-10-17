import { Test } from "@nestjs/testing"
import { createHmac } from "node:crypto"
import { deriveStateKey, sameSitePath, signStateToken, verifyStateToken } from "./signed-state.policy"
import type { SignedState } from "./signed-state.contracts"
const SUBJECT = Symbol("signed-state.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sameSitePath, deriveStateKey, signStateToken, verifyStateToken } }],
    }).compile()
    return moduleRef.get<typeof import("./signed-state.policy")>(SUBJECT)
}

const NOW = 1_800_000_000_000
const KEY = Buffer.alloc(32, 7)
const STATE: SignedState = { w: "ws-1", u: "u-1", r: "/connections", e: NOW + 1000, p: "drive_read" }

const signedBody = (body: object): string => {
    const encoded = Buffer.from(JSON.stringify(body)).toString("base64url")
    return `${encoded}.${createHmac("sha256", KEY).update(encoded).digest().toString("base64url")}`
}

describe("sameSitePath", () => {
    it("keeps a same-site path", async () => {
        const subject = await build()

        expect(subject.sameSitePath("/agents?tab=1", "/home")).toBe("/agents?tab=1")
    })

    it.each(["//evil.example", "https://evil.example", "/a\nb", "", null, undefined])(
        "returns the fallback for %p",
        async (value) => {
            const subject = await build()

            expect(subject.sameSitePath(value, "/home")).toBe("/home")
        },
    )
})

describe("deriveStateKey", () => {
    it("derives a 32-byte key that depends on the label", async () => {
        const subject = await build()

        const channel = Buffer.alloc(32, 1).toString("base64")
        const google = subject.deriveStateKey(channel, "google")
        const meta = subject.deriveStateKey(channel, "meta")

        expect(google).toHaveLength(32)
        expect(meta).toHaveLength(32)
        expect(google?.equals(meta ?? Buffer.alloc(0))).toBe(false)
    })

    it("returns null for a channel key that is not 32 bytes", async () => {
        const subject = await build()

        expect(subject.deriveStateKey("c2hvcnQ=", "google")).toBeNull()
    })
})

describe("signStateToken and verifyStateToken", () => {
    it("round-trips a state signed with the same key", async () => {
        const subject = await build()

        expect(subject.verifyStateToken(KEY, subject.signStateToken(KEY, STATE), NOW)).toEqual(STATE)
    })

    it("refuses a state signed with another key", async () => {
        const subject = await build()

        expect(subject.verifyStateToken(KEY, subject.signStateToken(Buffer.alloc(32, 8), STATE), NOW)).toBeNull()
    })

    it("refuses an expired state", async () => {
        const subject = await build()

        expect(subject.verifyStateToken(KEY, subject.signStateToken(KEY, STATE), NOW + 1001)).toBeNull()
    })

    it.each([null, undefined, "", "one-part", "a.b.c"])("refuses the malformed value %p", async (value) => {
        const subject = await build()

        expect(subject.verifyStateToken(KEY, value, NOW)).toBeNull()
    })

    it("refuses a validly signed body that is not a state", async () => {
        const subject = await build()

        expect(subject.verifyStateToken(KEY, signedBody({ w: "ws-1", e: NOW + 1000 }), NOW)).toBeNull()
    })

    it("refuses a validly signed body that is not JSON", async () => {
        const subject = await build()

        const encoded = Buffer.from("{not json").toString("base64url")
        const value = `${encoded}.${createHmac("sha256", KEY).update(encoded).digest().toString("base64url")}`

        expect(subject.verifyStateToken(KEY, value, NOW)).toBeNull()
    })
})
