import { Test } from "@nestjs/testing"
import {
    parseJson as parseJsonImplementation,
    parseLooseJson as parseLooseJsonImplementation,
    textField as textFieldImplementation,
    textList as textListImplementation,
} from "./json.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    parseJson: typeof parseJsonImplementation
    parseLooseJson: typeof parseLooseJsonImplementation
    textField: typeof textFieldImplementation
    textList: typeof textListImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    parseJson: parseJsonImplementation,
                    parseLooseJson: parseLooseJsonImplementation,
                    textField: textFieldImplementation,
                    textList: textListImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("hiring JSON policy", () => {
    it("returns parsed JSON values and preserves the parser error", async () => {
        const subject = await buildSubject()

        expect(subject.parseJson(`{"name":"An","count":2}`)).toEqual({ ok: true, value: { name: "An", count: 2 } })
        expect(subject.parseJson("null")).toEqual({ ok: true, value: null })
        expect(subject.parseJson("")).toEqual({ ok: false, cause: new SyntaxError("Unexpected end of JSON input") })
    })

    it("reads objects as plain or fenced JSON", async () => {
        const subject = await buildSubject()

        expect(subject.parseLooseJson(`  {"name":"An"}  `)).toEqual({ name: "An" })
        expect(subject.parseLooseJson(["```json", `{"name":"An"}`, "```"].join("\n"))).toEqual({ name: "An" })
        expect(subject.parseLooseJson(["```JSON", `{"name":"An"}`, "```"].join(" "))).toEqual({ name: "An" })
        expect(subject.parseLooseJson(["```", `{"name":"An"}`, "```"].join("\n"))).toEqual({ name: "An" })
        expect(subject.parseLooseJson("{}")).toEqual({})
    })

    it("extracts the outer object from surrounding model text", async () => {
        const subject = await buildSubject()

        expect(subject.parseLooseJson(`Answer: {"nested":{"value":2}} end`)).toEqual({ nested: { value: 2 } })
        expect(subject.parseLooseJson(` [{"value":2}] `)).toEqual({ value: 2 })
    })

    it("returns null when there is no valid JSON object", async () => {
        const subject = await buildSubject()

        expect(subject.parseLooseJson("plain")).toBeNull()
        expect(subject.parseLooseJson("null")).toBeNull()
        expect(subject.parseLooseJson("42")).toBeNull()
        expect(subject.parseLooseJson(`"name"`)).toBeNull()
        expect(subject.parseLooseJson("[]")).toBeNull()
        expect(subject.parseLooseJson("{")).toBeNull()
        expect(subject.parseLooseJson("} before {")).toBeNull()
        expect(subject.parseLooseJson("prefix {bad} suffix")).toBeNull()
    })

    it("trims string fields and uses empty text for absent or non-string fields", async () => {
        const subject = await buildSubject()

        expect(subject.textField({ name: " An " }, "name")).toBe("An")
        expect(subject.textField({ name: 2 }, "name")).toBe("")
        expect(subject.textField({}, "name")).toBe("")
        expect(subject.textField(null, "name")).toBe("")
    })

    it("keeps only string list entries without trimming them", async () => {
        const subject = await buildSubject()

        expect(subject.textList({ skills: [" coffee ", 3, null, true, ""] }, "skills")).toEqual([" coffee ", ""])
        expect(subject.textList({ skills: "coffee" }, "skills")).toEqual([])
        expect(subject.textList({}, "skills")).toEqual([])
        expect(subject.textList(null, "skills")).toEqual([])
    })
})
