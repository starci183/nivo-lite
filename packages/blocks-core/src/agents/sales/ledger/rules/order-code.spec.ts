import { newOrderCode, orderCodesIn, ORDER_PREFIX } from "./order-code"

describe("order codes", () => {
    it("makes a code of the prefix and five readable characters from the bytes it is given", () => {
        const code = newOrderCode((size) => Uint8Array.from({ length: size }, (_, index) => index))
        expect(code).toBe(`${ORDER_PREFIX}23456`)
    })

    it("wraps a byte round the alphabet", () => {
        expect(newOrderCode(() => Uint8Array.from([31, 32, 33, 34, 35]))).toBe("NIVO23456")
    })

    it("finds a code however the bank spaced, dashed or cased it", () => {
        expect(orderCodesIn("nivo 8f3k2 - chuyen tien")).toEqual(["NIVO8F3K2"])
        expect(orderCodesIn("NIVO-8F3K2", "ck NIVO7QWE9")).toEqual(["NIVO8F3K2", "NIVO7QWE9"])
    })

    it("finds the same code once, and a code after a false start", () => {
        expect(orderCodesIn("NIVO8F3K2", "nivo8f3k2")).toEqual(["NIVO8F3K2"])
        expect(orderCodesIn("NIVO NIVO8F3K2")).toEqual(["NIVO8F3K2"])
    })

    it("finds nothing in a text with no code, an unreadable code or no text", () => {
        expect(orderCodesIn("chuyen tien", "NIVO01OIL", null, undefined)).toEqual([])
        expect(orderCodesIn()).toEqual([])
    })
})
