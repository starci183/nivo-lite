import { createHash } from "node:crypto"
import { challengeOf, newVerifier } from "./zalo-oauth.policy"

describe("zalo-oauth policy", () => {
    describe("newVerifier", () => {
        it("is a long base64url string and differs on every call", () => {
            const first = newVerifier()

            expect(first).toMatch(/^[A-Za-z0-9_-]{64}$/u)
            expect(newVerifier()).not.toBe(first)
        })
    })

    describe("challengeOf", () => {
        it("is the base64url sha256 of the verifier", () => {
            expect(challengeOf("verifier")).toBe(createHash("sha256").update("verifier").digest("base64url"))
        })
    })
})
