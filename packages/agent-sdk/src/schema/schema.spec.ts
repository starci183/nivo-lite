import { entriesAtMost } from "./entries"
import { present } from "./present"
import { isNamespaced, namespaceOf, wordsOf } from "./namespaced"
import { specText } from "./spec-text.schema"

describe("isNamespaced and namespaceOf", () => {
    it("accepts kebab-case parts and names the namespace", () => {
        expect(isNamespaced("core.record-list")).toBe(true)
        expect(namespaceOf("core.record-list")).toBe("core")
    })

    it("refuses a missing dot, upper case and a leading digit", () => {
        expect(isNamespaced("core")).toBe(false)
        expect(isNamespaced("Core.x")).toBe(false)
        expect(isNamespaced("core.1x")).toBe(false)
    })

    it("takes two to four parts: `nivo.<domain>.<object>.<verb>` is the longest", () => {
        expect(isNamespaced("customer.message.send")).toBe(true)
        expect(isNamespaced("nivo.lead.order.list")).toBe(true)
        expect(isNamespaced("nivo.lead.order.list.more")).toBe(false)
        expect(namespaceOf("nivo.lead.order.list")).toBe("nivo")
    })
})

describe("wordsOf", () => {
    it("translates a key and picks the viewer language of owner words", () => {
        expect(wordsOf({ key: "k" }, (key) => `t:${key}`, "en")).toBe("t:k")
        expect(wordsOf({ vi: "xin chao", en: "hello" }, () => "", "vi")).toBe("xin chao")
        expect(wordsOf({ vi: "xin chao", en: "hello" }, () => "", "en")).toBe("hello")
    })
})

describe("specText", () => {
    it("parses a key and both languages, and refuses one language or an empty key", () => {
        expect(specText.safeParse({ key: "k" }).success).toBe(true)
        expect(specText.safeParse({ vi: "a", en: "b" }).success).toBe(true)
        expect(specText.safeParse({ vi: "a" }).success).toBe(false)
        expect(specText.safeParse({ key: "" }).success).toBe(false)
    })
})

describe("entriesAtMost", () => {
    it("holds a record up to its limit and refuses one past it", () => {
        const atMostTwo = entriesAtMost(2)
        expect(atMostTwo({ a: 1, b: 2 })).toBe(true)
        expect(atMostTwo({ a: 1, b: 2, c: 3 })).toBe(false)
    })
})

describe("present", () => {
    it("hands a value back, and refuses an absent one with a code", () => {
        expect(present(0)).toBe(0)
        expect(() => present(undefined)).toThrow("ABSENT")
    })
})
