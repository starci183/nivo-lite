import { Test } from "@nestjs/testing"
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

const POLICY = Symbol("./config.policy")
type PolicySubject = {
    isTemplateKey: typeof isTemplateKey
    resolveConfig: typeof resolveConfig
    placeholdersOf: typeof placeholdersOf
    fillBody: typeof fillBody
    bodyProblem: typeof bodyProblem
    bodyLimit: typeof bodyLimit
    acceptableProposal: typeof acceptableProposal
    stripQuotes: typeof stripQuotes
    acceptableMessage: typeof acceptableMessage
    hasText: typeof hasText
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: POLICY,
                useValue: {
                    isTemplateKey,
                    resolveConfig,
                    placeholdersOf,
                    fillBody,
                    bodyProblem,
                    bodyLimit,
                    acceptableProposal,
                    stripQuotes,
                    acceptableMessage,
                    hasText,
                },
            },
        ],
    }).compile()
    return moduleRef.get<PolicySubject>(POLICY)
}

describe("isTemplateKey", () => {
    it("accepts a lower case key and refuses the rest", async () => {
        const subject = await buildSubject()

        expect(subject.isTemplateKey("thank_payment")).toBe(true)
        expect(subject.isTemplateKey("Thank")).toBe(false)
        expect(subject.isTemplateKey("ab")).toBe(false)
        expect(subject.isTemplateKey(3)).toBe(false)
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

    it("starts from the defaults when nothing was saved", async () => {
        const subject = await buildSubject()

        expect(subject.resolveConfig(def, undefined)).toEqual({
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
        expect(subject.resolveConfig(def, null)).toMatchObject({ days: 3 })
    })

    it("clamps numbers, rounds them and reads a toggle from true or the text true", async () => {
        const subject = await buildSubject()

        expect(subject.resolveConfig(def, { days: 99, free: 2.6, on: true }).days).toBe(30)
        expect(subject.resolveConfig(def, { days: -4 }).days).toBe(1)
        expect(subject.resolveConfig(def, { free: 2.6 }).free).toBe(3)
        expect(subject.resolveConfig(def, { days: "abc" }).days).toBe(1)
        expect(subject.resolveConfig(def, { on: "true" }).on).toBe(true)
        expect(subject.resolveConfig(def, { on: "yes" }).on).toBe(false)
    })

    it("keeps a valid time and a clean email, and falls back otherwise", async () => {
        const subject = await buildSubject()

        expect(subject.resolveConfig(def, { at: "21:45" }).at).toBe("21:45")
        expect(subject.resolveConfig(def, { at: "25:00" }).at).toBe("09:00")
        expect(subject.resolveConfig(def, { later: "bad" }).later).toBe("00:00")
        expect(subject.resolveConfig(def, { mail: " Lan@Shop.VN " }).mail).toBe("lan@shop.vn")
        expect(subject.resolveConfig(def, { mail: "not an email" }).mail).toBe("")
    })

    it("trims and cuts a text and falls back to the default when it is empty", async () => {
        const subject = await buildSubject()

        expect(subject.resolveConfig(def, { note: "  abcdefgh " }).note).toBe("abcde")
        expect(subject.resolveConfig(def, { note: "   " }).note).toBe("hi")
        expect(subject.resolveConfig(def, { memo: "x".repeat(300) }).memo).toHaveLength(200)
    })

    it("keeps a saved key that is not a setting and ignores a value that is not a text, number or switch", async () => {
        const subject = await buildSubject()

        const config = subject.resolveConfig(def, { extra: "keep", nested: { a: 1 } })

        expect(config.extra).toBe("keep")
        expect(config).not.toHaveProperty("nested")
    })
})

describe("placeholders", () => {
    it("lists the names of the blanks of a text", async () => {
        const subject = await buildSubject()

        expect([...subject.placeholdersOf("Hi {ten_khach}, {so_tien} {ten_khach} {Bad}")]).toEqual([
            "ten_khach",
            "so_tien",
        ])
    })

    it("fills the blanks, falls back on a neutral word and tidies the spaces", async () => {
        const subject = await buildSubject()

        const text = subject.fillBody(
            "Hi {ten_khach} ,  you owe {so_tien} .  {ghost}",
            { ten_khach: "  An ", so_tien: "  " },
            { so_tien: "your invoice" },
        )

        expect(text).toBe("Hi An, you owe your invoice.")
    })

    it("reads a blank with no value and no neutral word as nothing", async () => {
        const subject = await buildSubject()

        expect(subject.fillBody("A{x}B", {}, {})).toBe("AB")
    })
})

describe("bodyProblem", () => {
    const def = buildTemplate({ variables: ["ten_khach"] })

    it("refuses a body that is too short, or that names a blank the template does not offer", async () => {
        const subject = await buildSubject()

        expect(subject.bodyProblem(def, "short", 10)).toBe("short")
        expect(subject.bodyProblem(def, "A long enough {nope} body", 10)).toBe("nope")
        expect(subject.bodyProblem(def, "A long enough {ten_khach} body", 10)).toBeNull()
    })

    it("limits a message to 600 characters and a whole email to 4000", async () => {
        const subject = await buildSubject()

        expect(subject.bodyLimit(def)).toBe(600)
        expect(subject.bodyLimit(buildTemplate({ executor: "n8n" }))).toBe(4000)
    })
})

describe("acceptableProposal", () => {
    const def = buildTemplate({ variables: ["ten_khach", "so_tien"] })
    const base = "Hi {ten_khach}, {so_tien}"

    it("accepts a plain text that keeps every blank of the frame and invents none", async () => {
        const subject = await buildSubject()

        expect(subject.acceptableProposal("Dear {ten_khach}, {so_tien} please", def, base)).toBe(true)
    })

    it.each([
        ["", "empty"],
        ["x".repeat(601), "too long"],
        ["**bold** {ten_khach} {so_tien}", "markdown bold"],
        ["# title {ten_khach} {so_tien}", "markdown title"],
        ["```code``` {ten_khach} {so_tien}", "code fence"],
        ["Dear {ten_khach}", "a blank of the frame is missing"],
        ["Dear {ten_khach} {so_tien} {extra}", "an invented blank"],
    ])("refuses %p (%s)", async (text) => {
        const subject = await buildSubject()

        expect(subject.acceptableProposal(text, def, base)).toBe(false)
    })
})

describe("text helpers", () => {
    it("strips the quotes a model wraps around a text", async () => {
        const subject = await buildSubject()

        expect(subject.stripQuotes('  "hello"  ')).toBe("hello")
        expect(subject.stripQuotes("“hello”")).toBe("hello")
        expect(subject.stripQuotes("plain")).toBe("plain")
    })

    it("accepts a per-case message of a sensible length with no raw blank", async () => {
        const subject = await buildSubject()

        expect(subject.acceptableMessage("Hello")).toBe(true)
        expect(subject.acceptableMessage("")).toBe(false)
        expect(subject.acceptableMessage("x".repeat(701))).toBe(false)
        expect(subject.acceptableMessage("Hello {ten_khach}")).toBe(false)
    })

    it("tells whether a proposal has any text", async () => {
        const subject = await buildSubject()

        expect(subject.hasText("a")).toBe(true)
        expect(subject.hasText("")).toBe(false)
        expect(subject.hasText(null)).toBe(false)
    })
})
