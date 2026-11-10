import { agentGuidanceOf } from "./agent-guidance"
import { MINDSET_HEADER } from "./mindset"

describe("agentGuidanceOf", () => {
    it("gives an agent its policy, its default limits and its base mindset, in the shop's language", () => {
        const text = agentGuidanceOf("accounting", "vi")
        expect(text).toContain("CHÍNH SÁCH")
        expect(text).toContain("chủ tiệm")
        expect(text).not.toContain("underpayment")
        expect(text).toContain(MINDSET_HEADER)
    })

    it("words the policy in English for an English shop", () => {
        expect(agentGuidanceOf("sales", "en")).toContain("approval threshold")
    })

    it("is empty for a module without an agent", () => {
        expect(agentGuidanceOf("platform", "vi")).toBe("")
        expect(agentGuidanceOf("nothing", "en")).toBe("")
    })
})
