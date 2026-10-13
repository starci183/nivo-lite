import { buildTemplate, TEXT } from "@tests/fixtures/builders/automations.builder"
import {
    acceptableMessage,
    acceptableProposal,
    bodyLimit,
    bodyProblem,
    fillBody,
    hasText,
    isTemplateKey,
    placeholdersOf,
    resolveConfig,
    stripQuotes,
} from "./config.policy"

describe("isTemplateKey", () => {
    it("accepts a lower case key and refuses the rest", () => {
        expect(isTemplateKey("thank_payment")).toBe(true)
        expect(isTemplateKey("Thank")).toBe(false)
        expect(isTemplateKey("ab")).toBe(false)
        expect(isTemplateKey(3)).toBe(false)
    })
})

describe("resolveConfig", () => {
    const def = buildTemplate({
        settings: [
            { key: "days", kind: "number", label: TEXT, min: 1, max: 30 },
            { key: "free", kind: "number", label: TEXT },
            { key: "on", kind: "toggle", label: TEXT },
            { key: "at", kind: "time", label: TEXT },
            { key: "later", kind: "time", label: TEXT },
            { key: "mail", kind: "email", label: TEXT },
            { key: "note", kind: "text", label: TEXT, maxLength: 5 },
            { key: "memo", kind: "textarea", label: TEXT },
            { key: "title", kind: "text", label: TEXT },
        ],
        defaults: { days: 3, at: "09:00", note: "hi", memo: "" },
    })

    it("starts from the defaults when nothing was saved", () => {
        expect(resolveConfig(def, undefined)).toEqual({
            days: 3,
            free: 0,
            on: false,
            at: "09:00",
            later: "00:00",
            mail: "",
            note: "hi",
            memo: "",
            title: "",
        })
        expect(resolveConfig(def, null)).toMatchObject({ days: 3 })
    })

    it("clamps numbers, rounds them and reads a toggle from true or the text true", () => {
        expect(resolveConfig(def, { days: 99, free: 2.6, on: true }).days).toBe(30)
        expect(resolveConfig(def, { days: -4 }).days).toBe(1)
        expect(resolveConfig(def, { free: 2.6 }).free).toBe(3)
        expect(resolveConfig(def, { days: "abc" }).days).toBe(1)
        expect(resolveConfig(def, { on: "true" }).on).toBe(true)
        expect(resolveConfig(def, { on: "yes" }).on).toBe(false)
    })

    it("keeps a valid time and a clean email, and falls back otherwise", () => {
        expect(resolveConfig(def, { at: "21:45" }).at).toBe("21:45")
        expect(resolveConfig(def, { at: "25:00" }).at).toBe("09:00")
        expect(resolveConfig(def, { later: "bad" }).later).toBe("00:00")
        expect(resolveConfig(def, { mail: " Lan@Shop.VN " }).mail).toBe("lan@shop.vn")
        expect(resolveConfig(def, { mail: "not an email" }).mail).toBe("")
    })

    it("trims and cuts a text and falls back to the default when it is empty", () => {
        expect(resolveConfig(def, { note: "  abcdefgh " }).note).toBe("abcde")
        expect(resolveConfig(def, { note: "   " }).note).toBe("hi")
        expect(resolveConfig(def, { memo: "x".repeat(300) }).memo).toHaveLength(200)
    })

    it("keeps a saved key that is not a setting and ignores a value that is not a text, number or switch", () => {
        const config = resolveConfig(def, { extra: "keep", nested: { a: 1 } })

        expect(config.extra).toBe("keep")
        expect(config).not.toHaveProperty("nested")
    })
})

describe("placeholders", () => {
    it("lists the names of the blanks of a text", () => {
        expect([...placeholdersOf("Hi {ten_khach}, {so_tien} {ten_khach} {Bad}")]).toEqual(["ten_khach", "so_tien"])
    })

    it("fills the blanks, falls back on a neutral word and tidies the spaces", () => {
        const text = fillBody(
            "Hi {ten_khach} ,  you owe {so_tien} .  {ghost}",
            { ten_khach: "  An ", so_tien: "  " },
            { so_tien: "your invoice" },
        )

        expect(text).toBe("Hi An, you owe your invoice.")
    })

    it("reads a blank with no value and no neutral word as nothing", () => {
        expect(fillBody("A{x}B", {}, {})).toBe("AB")
    })
})

describe("bodyProblem", () => {
    const def = buildTemplate({ variables: ["ten_khach"] })

    it("refuses a body that is too short, or that names a blank the template does not offer", () => {
        expect(bodyProblem(def, "short", 10)).toBe("short")
        expect(bodyProblem(def, "A long enough {nope} body", 10)).toBe("nope")
        expect(bodyProblem(def, "A long enough {ten_khach} body", 10)).toBeNull()
    })

    it("limits a message to 600 characters and a whole email to 4000", () => {
        expect(bodyLimit(def)).toBe(600)
        expect(bodyLimit(buildTemplate({ executor: "n8n" }))).toBe(4000)
    })
})

describe("acceptableProposal", () => {
    const def = buildTemplate({ variables: ["ten_khach", "so_tien"] })
    const base = "Hi {ten_khach}, {so_tien}"

    it("accepts a plain text that keeps every blank of the frame and invents none", () => {
        expect(acceptableProposal("Dear {ten_khach}, {so_tien} please", def, base)).toBe(true)
    })

    it.each([
        ["", "empty"],
        ["x".repeat(601), "too long"],
        ["**bold** {ten_khach} {so_tien}", "markdown bold"],
        ["# title {ten_khach} {so_tien}", "markdown title"],
        ["```code``` {ten_khach} {so_tien}", "code fence"],
        ["Dear {ten_khach}", "a blank of the frame is missing"],
        ["Dear {ten_khach} {so_tien} {extra}", "an invented blank"],
    ])("refuses %p (%s)", (text) => {
        expect(acceptableProposal(text, def, base)).toBe(false)
    })
})

describe("text helpers", () => {
    it("strips the quotes a model wraps around a text", () => {
        expect(stripQuotes('  "hello"  ')).toBe("hello")
        expect(stripQuotes("“hello”")).toBe("hello")
        expect(stripQuotes("plain")).toBe("plain")
    })

    it("accepts a per-case message of a sensible length with no raw blank", () => {
        expect(acceptableMessage("Hello")).toBe(true)
        expect(acceptableMessage("")).toBe(false)
        expect(acceptableMessage("x".repeat(701))).toBe(false)
        expect(acceptableMessage("Hello {ten_khach}")).toBe(false)
    })

    it("tells whether a proposal has any text", () => {
        expect(hasText("a")).toBe(true)
        expect(hasText("")).toBe(false)
        expect(hasText(null)).toBe(false)
    })
})
