import { MODULE_CRAFT, agentGuidanceOf } from "./agent-guidance"
import { MODULE_DECLARATIONS } from "./module-declarations"
import { MINDSET_HEADER } from "./mindset"

describe("agentGuidanceOf", () => {
    it("gives an agent its craft words and its base mindset, in the shop's language", () => {
        const text = agentGuidanceOf("sales", "vi")
        expect(text).toContain("CH\u00cdNH S\u00c1CH")
        expect(text).toContain("ch\u1ee7 ti\u1ec7m")
        expect(text).not.toContain("underpayment")
        expect(text).toContain(MINDSET_HEADER)
    })

    it("words the craft in English for an English shop", () => {
        expect(agentGuidanceOf("sales", "en")).toContain("approval threshold")
    })

    it("reads the craft of every module that declares an agent, and of no other", () => {
        const declared = MODULE_DECLARATIONS.filter((module) => module.agent !== undefined).map((module) => module.key)
        expect(Object.keys(MODULE_CRAFT).sort()).toEqual([...declared].sort())
        for (const key of declared) {
            for (const locale of ["vi", "en"] as const) expect(agentGuidanceOf(key, locale)).toContain(MODULE_CRAFT[key]?.[locale])
        }
    })

    it("is empty for a module without an agent", () => {
        expect(agentGuidanceOf("platform", "vi")).toBe("")
        expect(agentGuidanceOf("nothing", "en")).toBe("")
    })
})
