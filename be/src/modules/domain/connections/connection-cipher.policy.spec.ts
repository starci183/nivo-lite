import { randomBytes } from "node:crypto"
import { decodeChannelKey, sha256 } from "./connection-cipher.policy"

const key = randomBytes(32)

describe("connection cipher policy", () => {
    describe("decodeChannelKey", () => {
        it("accepts 32 bytes in base64", () => {
            expect(decodeChannelKey(key.toString("base64"))).toEqual(key)
        })

        it("refuses any other length", () => {
            expect(decodeChannelKey(randomBytes(16).toString("base64"))).toBeNull()
            expect(decodeChannelKey("")).toBeNull()
        })
    })

    describe("sha256", () => {
        it("hashes to the known digest", () => {
            expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        })
    })
})
