import { APPROVAL_CONTENT_VALUE_MAX, approvalContentOf } from "./approval-content.policy"

describe("approvalContentOf", () => {
    it("carries a marked member in full: 2,000 words stay 2,000, never cut to a fact's width", () => {
        const text = "Dạ chị ơi. ".repeat(200).slice(0, 2000)

        const [item] = approvalContentOf({ text, other: "x" }, ["text"])

        expect(item).toEqual({ name: "text", kind: "text", value: text })
        expect(item?.value).toHaveLength(2000)
    })

    it("reads a list of `{ url }` as addresses, in order, beside the words", () => {
        const items = approvalContentOf(
            { text: "Mời chị", images: [{ url: "https://img.example/qr.png", caption: "QR" }, { caption: "no address" }, { url: "https://img.example/b.png" }] },
            ["text", "images"],
        )

        expect(items).toEqual([
            { name: "text", kind: "text", value: "Mời chị" },
            { name: "images", kind: "address", value: "https://img.example/qr.png" },
            { name: "images", kind: "address", value: "https://img.example/b.png" },
        ])
    })

    it("carries nothing for a member that is absent, empty or of another shape, and nothing when no member is marked", () => {
        expect(approvalContentOf({ text: "", n: 3, o: { url: "u" } }, ["text", "n", "o", "missing"])).toEqual([])
        expect(approvalContentOf({ text: "Dạ" }, [])).toEqual([])
        expect(approvalContentOf("not an object", ["text"])).toEqual([])
    })

    it("is bounded only by the card's limits: a value over the tool's maximum is cut there, and at most twenty items ride", () => {
        const long = "a".repeat(APPROVAL_CONTENT_VALUE_MAX + 50)
        expect(approvalContentOf({ text: long }, ["text"])[0]?.value).toHaveLength(APPROVAL_CONTENT_VALUE_MAX)
        const images = Array.from({ length: 30 }, (_, index) => ({ url: `https://img.example/${String(index)}.png` }))
        expect(approvalContentOf({ images }, ["images"])).toHaveLength(20)
    })
})
