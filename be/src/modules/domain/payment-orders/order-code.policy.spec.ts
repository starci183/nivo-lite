import { newOrderCode, orderCodesIn } from "./order-code.policy"

describe("order code policy", () => {
    describe("newOrderCode", () => {
        it("prints NIVO and five characters of the readable alphabet", () => {
            expect(newOrderCode(() => Uint8Array.from([0, 1, 2, 3, 4]))).toBe("NIVO23456")
        })

        it("wraps a byte past the alphabet and never prints 0, O, 1, I or L", () => {
            expect(newOrderCode(() => Uint8Array.from([31, 62, 255, 0, 30]))).toBe("NIVO2292Z")
            for (let run = 0; run < 50; run += 1) expect(newOrderCode()).toMatch(/^NIVO[2-9A-HJKMNP-Z]{5}$/)
        })
    })

    describe("orderCodesIn", () => {
        it("finds a code whatever the case, spaces and dashes the bank added", () => {
            expect(orderCodesIn("nivo 8f3k2 - chuyen tien")).toEqual(["NIVO8F3K2"])
        })

        it("finds every distinct code across texts and ignores empty texts", () => {
            expect(orderCodesIn(null, undefined, "NIVO8F3K2 NIVO8F3K2", "x NIVO23456 y")).toEqual([
                "NIVO8F3K2",
                "NIVO23456",
            ])
        })

        it("skips a prefix that is not followed by five readable characters", () => {
            expect(orderCodesIn("NIVO1OL00", "NIVO", "NIVO8F3", "NIVO NIVO23456")).toEqual(["NIVO23456"])
        })

        it("answers nothing for a text without a code", () => {
            expect(orderCodesIn("chuyen tien an trua")).toEqual([])
        })
    })
})
