import { modelPickerOf } from "./model-picker.mapper"

describe("modelPickerOf", () => {
    it("offers Auto first, then Sonnet and DeepSeek, in the asked language, Sonnet unavailable while Anthropic holds no key", () => {
        const picker = modelPickerOf("vi", { anthropic: false, openrouter: true })

        expect(picker.choices.map((choice) => [choice.id, choice.available, choice.providerLabel])).toEqual([
            ["auto", true, null],
            ["claude-sonnet-5-5", false, "Anthropic"],
            ["deepseek/deepseek-v4.1-flash", true, "OpenRouter"],
        ])
        expect(picker.choices[0]?.hint).toBe("NIVO chọn model cho từng lần chạy của bước này")
        expect(picker.defaultModel).toBe("claude-sonnet-5-5")
    })

    it("lists what blocks-core declares for every AI node step, sorted by id", () => {
        const picker = modelPickerOf("en", { anthropic: true, openrouter: true })

        expect(picker.choices.every((choice) => choice.available)).toBe(true)
        expect(picker.nodes.find((node) => node.nodeId === "accounting.match-payment")).toEqual({
            nodeId: "accounting.match-payment",
            model: "auto",
            weight: "heavy",
        })
        expect(picker.nodes.map((node) => node.nodeId)).toEqual([...picker.nodes.map((node) => node.nodeId)].sort())
    })
})
