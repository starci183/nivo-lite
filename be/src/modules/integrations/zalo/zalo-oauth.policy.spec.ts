import { Test } from "@nestjs/testing"
import { createHash } from "node:crypto"
import { challengeOf, newVerifier } from "./zalo-oauth.policy"

const SUBJECT = Symbol("zalo-oauth.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { newVerifier, challengeOf } }],
    }).compile()
    return moduleRef.get<typeof import("./zalo-oauth.policy")>(SUBJECT)
}

describe("zalo-oauth policy", () => {
    describe("newVerifier", () => {
        it("is a long base64url string and differs on every call", async () => {
            const subject = await buildSubject()

            const first = subject.newVerifier()

            expect(first).toMatch(/^[A-Za-z0-9_-]{64}$/u)
            expect(subject.newVerifier()).not.toBe(first)
        })
    })

    describe("challengeOf", () => {
        it("is the base64url sha256 of the verifier", async () => {
            const subject = await buildSubject()

            expect(subject.challengeOf("verifier")).toBe(createHash("sha256").update("verifier").digest("base64url"))
        })
    })
})
