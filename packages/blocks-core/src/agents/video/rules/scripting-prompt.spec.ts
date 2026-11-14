import { outlineOf, sceneCountOf, scriptAskText, voiceCharsOf } from "./scripting-prompt"
import { VIDEO_GOAL_OUTLINES } from "./scripting-outlines"
import { VIDEO_GOALS } from "./spec"

describe("sceneCountOf and voiceCharsOf", () => {
    it("asks one scene about every six seconds, three to eight", () => {
        expect(sceneCountOf(10)).toBe(3)
        expect(sceneCountOf(30)).toBe(5)
        expect(sceneCountOf(90)).toBe(8)
    })

    it("bounds each voice so the video keeps its length, never below 40 characters", () => {
        expect(voiceCharsOf(30, 5)).toBe(73)
        expect(voiceCharsOf(10, 8)).toBe(40)
    })
})

describe("the goal outlines", () => {
    it("give every goal an opening, at least one body point and a close", () => {
        for (const goal of VIDEO_GOALS) {
            const roles = VIDEO_GOAL_OUTLINES[goal].steps.map((step) => step.role)
            expect(roles[0]).toBe("hook")
            expect(roles[roles.length - 1]).toBe("cta")
            expect(roles).toContain("body")
        }
    })

    it("numbers the outline with the body points in turn", () => {
        const lines = outlineOf("offer", 5).split("\n")
        const bodies = VIDEO_GOAL_OUTLINES.offer.steps.filter((step) => step.role === "body")
        expect(lines).toHaveLength(5)
        expect(lines[0]?.startsWith("1. HOOK: ")).toBe(true)
        expect(lines[3]).toBe(`4. BODY: ${bodies[0]?.brief ?? ""}`)
        expect(lines[4]?.startsWith("5. CTA: ")).toBe(true)
    })
})

describe("scriptAskText", () => {
    it("names the shop, the goal, the format, the scene count and the owner's stress, and leaves out an empty brief", () => {
        const asked = scriptAskText({
            shop: "Ti\u1ec7m Hoa Mai",
            goal: "service",
            aspect: "9:16",
            targetSeconds: 30,
            brief: " Giao trong ng\u00e0y ",
        })
        expect(asked).toContain("SHOP: Ti\u1ec7m Hoa Mai")
        expect(asked).toContain(`GOAL: ${VIDEO_GOAL_OUTLINES.service.label}.`)
        expect(asked).toContain("FORMAT: 9:16, about 30 seconds in total.")
        expect(asked).toContain("SCENES: exactly 5.")
        expect(asked).toContain("THE OWNER WANTS TO STRESS: Giao trong ng\u00e0y")
        expect(scriptAskText({ shop: "", goal: "custom", aspect: "16:9", targetSeconds: 20, brief: " " })).not.toContain(
            "STRESS",
        )
    })
})
