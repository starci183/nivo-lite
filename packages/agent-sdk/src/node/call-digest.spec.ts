import { callDigestOf, stableJson } from "./call-digest"

describe("callDigestOf", () => {
    it("keeps the stored digest of a plain text call", () => {
        expect(callDigestOf("order.notify", { text: "hi" })).toBe("f77057d9d06ff25f")
    })

    it("keeps the stored digest of a call whose text is inside the basic plane", () => {
        expect(callDigestOf("order.notify", { text: "gi\u1ea3m gi\u00e1" })).toBe("19e24f06222bf0db")
    })

    it("keeps the stored digest of a call whose text holds surrogate pairs", () => {
        expect(callDigestOf("order.notify", { text: "ok \u{1f600} \u{1f338}" })).toBe("57f20eb0efaa191a")
    })

    it("keeps the stored digest of a call whose text holds lone surrogates", () => {
        expect(callDigestOf("probe", { text: "lone \uD83D x \uDE00" })).toBe("80cf62d7a42cca6b")
    })

    it("gives the same digest whatever the member order of the arguments", () => {
        expect(callDigestOf("order.notify", { a: 1, b: 2 })).toBe(callDigestOf("order.notify", { b: 2, a: 1 }))
    })
})

describe("stableJson", () => {
    it("writes members in name order and leaves an undefined member out", () => {
        expect(stableJson({ b: [1, { d: null, c: undefined }], a: "x" })).toBe('{"a":"x","b":[1,{"d":null}]}')
    })

    it("writes undefined alone as null", () => {
        expect(stableJson(undefined)).toBe("null")
    })
})
