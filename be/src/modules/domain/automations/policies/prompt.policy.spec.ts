import { buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { CLASSIFY_SYSTEM, FEEDBACK_MAX, caseSystem, proposalSystem, shopBlock } from "./prompt.policy"

describe("shopBlock", () => {
    it("lists the name, the hours, the tone and what the shop said about itself", () => {
        const block = shopBlock({ shop: "Tiem Hoa", hours: "08:00 - 21:00", tone: "warm" }, "We sell flowers.")

        expect(block.split("\n")).toEqual([
            "Shop name: Tiem Hoa",
            "Opening hours: 08:00 - 21:00",
            "Tone / brand voice: warm",
            "What the shop told NIVO about itself:",
            "We sell flowers.",
        ])
    })

    it("leaves out what is empty and cuts a long context", () => {
        expect(shopBlock({ shop: "Tiem Hoa", hours: "", tone: "" }, "")).toBe("Shop name: Tiem Hoa")
        expect(shopBlock({ shop: "S", hours: "", tone: "" }, "x".repeat(3000)).length).toBeLessThan(2600)
    })
})

describe("system instructions", () => {
    const def = buildTemplate({
        guardrails: [
            { vi: "Khong hua.", en: "No promises." },
            { vi: "Khong gia.", en: "No prices." },
        ],
    })

    it("tells a model to keep the placeholders of the base wording and to follow the guardrails", () => {
        const system = proposalSystem(def, "Hi {ten_khach}, {so_tien}")

        expect(system).toContain("({ten_khach}, {so_tien})")
        expect(system).toContain("Guardrails: Khong hua. Khong gia.")
    })

    it("tells a model to write one message inside the approved wording", () => {
        expect(caseSystem(def)).toContain("Guardrails: Khong hua. Khong gia.")
    })

    it("fixes the classification instruction and the length of feedback it reads", () => {
        expect(CLASSIFY_SYSTEM).toContain("POSITIVE, NEUTRAL or NEGATIVE")
        expect(FEEDBACK_MAX).toBe(500)
    })
})
