import { Test } from "@nestjs/testing"

import { sameText as realSameText, sha256Hex as realSha256Hex } from "./channel-secret.policy"

const SUBJECT = Symbol("channel-secret.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { sameText: realSameText, sha256Hex: realSha256Hex },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        sameText: typeof realSameText
        sha256Hex: typeof realSha256Hex
    }>(SUBJECT)
    const sameText = subject.sameText
    const sha256Hex = subject.sha256Hex

    return { sameText, sha256Hex }
}

describe("channel secret policy", () => {
    describe("sameText", () => {
        it("compares texts of equal length in constant time and refuses any difference", async () => {
            const { sameText } = await buildSubject()

            expect(sameText("abc", "abc")).toBe(true)
            expect(sameText("abc", "abd")).toBe(false)
            expect(sameText("abc", "abcd")).toBe(false)
        })
    })

    describe("sha256Hex", () => {
        it("is the SHA-256 hex digest", async () => {
            const { sha256Hex } = await buildSubject()

            expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        })
    })
})
