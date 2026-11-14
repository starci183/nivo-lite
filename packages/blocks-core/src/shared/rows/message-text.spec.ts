import { filledMessage, messageOf, messageTextOf } from "./message-text"

const TRANSLATE = (key: string): string => (key === "won" ? "{count} won, {share} of all" : key)

describe("messageOf", () => {
    it("is the message for a key with or without values", () => {
        expect(messageOf({ key: "won" })).toEqual({ key: "won" })
        expect(messageOf({ key: "won", values: { count: 7, share: "24%" } })).toEqual({
            key: "won",
            values: { count: 7, share: "24%" },
        })
    })

    it.each([
        ["a string", "won"],
        ["an empty key", { key: "" }],
        ["an unknown member", { key: "won", text: "x" }],
        ["a value that is no text or number", { key: "won", values: { count: true } }],
        [
            "more placeholders than a message may carry",
            { key: "won", values: Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`v${index}`, index])) },
        ],
        ["nothing", undefined],
    ])("is null for %s", (_name, value) => {
        expect(messageOf(value)).toBeNull()
    })
})

describe("filledMessage", () => {
    it("replaces each placeholder once, in one pass", () => {
        expect(filledMessage("{a} and {b}, {a}", { a: 1, b: "{a}" })).toBe("1 and {a}, 1")
    })

    it("keeps a placeholder without a value, and a template with no values", () => {
        expect(filledMessage("{a} {b}", { a: "x" })).toBe("x {b}")
        expect(filledMessage("{a}", undefined)).toBe("{a}")
        expect(filledMessage("{toString}", { a: 1 })).toBe("{toString}")
    })
})

describe("messageTextOf", () => {
    it("translates a message and fills it", () => {
        expect(messageTextOf({ key: "won", values: { count: 7, share: "24%" } }, TRANSLATE)).toBe("7 won, 24% of all")
    })

    it("draws a string or a number as it is and anything else as nothing", () => {
        expect(messageTextOf("30 days", TRANSLATE)).toBe("30 days")
        expect(messageTextOf(4, TRANSLATE)).toBe("4")
        expect(messageTextOf({ not: "a message" }, TRANSLATE)).toBe("")
        expect(messageTextOf(undefined, TRANSLATE)).toBe("")
    })
})
