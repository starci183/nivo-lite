import { createHash } from "node:crypto"
import { sha256HexOf } from "./sha256.policy"

describe("sha256HexOf", () => {
    it.each(["", "abc", "Sinh nh\u1eadt m\u1eb9\n03-08", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(1000)])(
        "gives the digest node's createHash gives (%#)",
        (text) => {
            expect(sha256HexOf(text)).toBe(createHash("sha256").update(text).digest("hex"))
        },
    )
})
