import { Test } from "@nestjs/testing"
import { randomBytes } from "node:crypto"
import { decodeChannelKey as realDecodeChannelKey, sha256 as realSha256 } from "./connection-cipher.policy"

const SUBJECT = Symbol("connection-cipher.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { decodeChannelKey: realDecodeChannelKey, sha256: realSha256 } }],
    }).compile()
    const subject = moduleRef.get<{ decodeChannelKey: typeof realDecodeChannelKey; sha256: typeof realSha256 }>(SUBJECT)
    const decodeChannelKey = subject.decodeChannelKey
    const sha256 = subject.sha256
    return { decodeChannelKey, sha256 }
}

const key = randomBytes(32)

describe("connection cipher policy", () => {
    describe("decodeChannelKey", () => {
        it("accepts 32 bytes in base64", async () => {
            const { decodeChannelKey } = await buildSubject()

            expect(decodeChannelKey(key.toString("base64"))).toEqual(key)
        })

        it("refuses any other length", async () => {
            const { decodeChannelKey } = await buildSubject()

            expect(decodeChannelKey(randomBytes(16).toString("base64"))).toBeNull()
            expect(decodeChannelKey("")).toBeNull()
        })
    })

    describe("sha256", () => {
        it("hashes to the known digest", async () => {
            const { sha256 } = await buildSubject()

            expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        })
    })
})
