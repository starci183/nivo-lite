import { STARTER_BRAND } from "./brand"
import { CHANNEL_RULES, channelHashtagsOf, draftGoalOf, planGoalOf, postTextOf } from "./channels"

describe("the channel rules", () => {
    it("gives Zalo no hashtag and caps the others at their limit", () => {
        expect(channelHashtagsOf("zalo", ["#a"], "#b")).toEqual([])
        expect(channelHashtagsOf("facebook", ["#a", "#b", "#c", "#d"], "#e")).toEqual(["#a", "#b", "#c"])
    })

    it("adds the brand's hashtags on TikTok and Instagram only", () => {
        expect(channelHashtagsOf("instagram", ["#a"], "#shop")).toEqual(["#a", "#shop"])
        expect(channelHashtagsOf("facebook", ["#a"], "#shop")).toEqual(["#a"])
    })

    it("puts the hashtags on their own line", () => {
        expect(postTextOf(" Hello ", ["#a", "#b"])).toBe("Hello\n\n#a #b")
        expect(postTextOf("Hello", [])).toBe("Hello")
    })

    it("names the channel's limit in the draft goal and the guardrails in both goals", () => {
        expect(draftGoalOf(STARTER_BRAND, "zalo")).toContain(`maximum ${String(CHANNEL_RULES.zalo.maxChars)} characters`)
        expect(planGoalOf(STARTER_BRAND)).toContain("Mandatory rules:")
    })
})
