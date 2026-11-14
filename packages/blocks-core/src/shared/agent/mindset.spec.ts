import { MINDSET_HEADER, hasMindset, mindsetBrief, mindsetOf } from "./mindset"
import type { MindsetModule } from "./mindset"

const MODULES: ReadonlyArray<MindsetModule> = ["sales", "chatbot", "lead_gen", "hiring", "content"]

describe("mindsetOf", () => {
    it.each(MODULES)("ships four to six documents for %s", (module) => {
        const documents = mindsetOf(module)

        // Four to six per area; the Sales module carries two (its own and its ledger area's, the books of the sale).
        const areas = module === "sales" ? 2 : 1
        expect(documents.length).toBeGreaterThanOrEqual(4 * areas)
        expect(documents.length).toBeLessThanOrEqual(6 * areas)
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
