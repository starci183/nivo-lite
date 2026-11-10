import { MINDSET_HEADER, hasMindset, mindsetBrief, mindsetOf } from "./mindset"
import type { MindsetModule } from "./mindset"

const MODULES: ReadonlyArray<MindsetModule> = ["sales", "accounting", "chatbot"]

describe("mindsetOf", () => {
    it.each(MODULES)("ships four to six documents for %s", (module) => {
        const documents = mindsetOf(module)

        expect(documents.length).toBeGreaterThanOrEqual(4)
        expect(documents.length).toBeLessThanOrEqual(6)
    })

    it.each(MODULES)("gives every %s document an id, a title and a body, with unique ids", (module) => {
        const documents = mindsetOf(module)

        expect(documents.every((d) => d.id !== "" && d.title !== "" && d.body.length > 200)).toBe(true)
        expect(new Set(documents.map((d) => d.id)).size).toBe(documents.length)
    })

    it("answers an empty list for a module without a mindset", () => {
        expect(mindsetOf("loyalty")).toEqual([])
        expect(hasMindset("loyalty")).toBe(false)
        expect(hasMindset("sales")).toBe(true)
    })
})

describe("mindsetBrief", () => {
    it("opens with the precedence header and lists each document under its title", () => {
        const brief = mindsetBrief("sales")

        expect(brief.startsWith(MINDSET_HEADER)).toBe(true)
        expect(mindsetOf("sales").every((d) => brief.includes(`## ${d.title}`))).toBe(true)
    })

    it("is empty for a module without a mindset", () => {
        expect(mindsetBrief("loyalty")).toBe("")
    })
})
