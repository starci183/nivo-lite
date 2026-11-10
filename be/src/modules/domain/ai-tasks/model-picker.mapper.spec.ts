import { nodeModelOf } from "@nivo-lite/blocks-core"
import { modelPickerOf } from "./model-picker.mapper"

describe("modelPickerOf", () => {
    it("offers Auto, Claude Sonnet 5.5 and Claude Haiku 5.5 only (DeepSeek retired), unavailable while Anthropic holds no key", () => {
        const picker = modelPickerOf("vi", { anthropic: false, openrouter: false })

        expect(picker.choices.map((choice) => [choice.id, choice.available, choice.providerLabel])).toEqual([
            ["auto", true, null],
            ["claude-sonnet-5-5", false, "Anthropic"],
            ["claude-haiku-5-5", false, "Anthropic"],
        ])
        expect(picker.choices[0]?.hint).toBe("NIVO chọn model cho từng lần chạy của bước này")
        expect(picker.defaultModel).toBe("claude-sonnet-5-5")
    })

    it("lists what blocks-core declares for every AI node step, sorted by id", () => {
        const picker = modelPickerOf("en", { anthropic: true, openrouter: false })

        expect(picker.choices.every((choice) => choice.available)).toBe(true)
        expect(picker.nodes.find((node) => node.nodeId === "accounting.match-payment")).toEqual({
            nodeId: "accounting.match-payment",
            model: nodeModelOf("accounting.match-payment")?.model,
            weight: "heavy",
        })
        expect(picker.nodes.map((node) => node.nodeId)).toEqual([...picker.nodes.map((node) => node.nodeId)].sort())
    })
})
