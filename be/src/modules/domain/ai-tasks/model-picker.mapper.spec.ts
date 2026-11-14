import { Test } from "@nestjs/testing"
import { INSTALLED } from "@modules/domain/installed-plugins"
import * as mapper from "./model-picker.mapper"

const SUBJECT = Symbol("model-picker.mapper")

let modelPickerOf: typeof mapper.modelPickerOf

beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: mapper }] }).compile()
    modelPickerOf = moduleRef.get<typeof mapper>(SUBJECT).modelPickerOf
})

describe("modelPickerOf", () => {
    it("offers Auto, Claude Sonnet 5.5 and Claude Haiku 5.5 only (DeepSeek retired), unavailable while Anthropic holds no key", () => {
        const picker = modelPickerOf("vi", { anthropic: false, openrouter: false })

        expect(picker.choices.map((choice) => [choice.id, choice.available, choice.providerLabel])).toEqual([
            ["auto", true, null],
            ["claude-sonnet-5-5", false, "Anthropic"],
            ["claude-haiku-5-5", false, "Anthropic"],
        ])
        expect(picker.choices[0]?.hint).toBe(
            "NIVO ch\u1ecdn model cho t\u1eebng l\u1ea7n ch\u1ea1y c\u1ee7a b\u01b0\u1edbc n\u00e0y",
        )
        expect(picker.defaultModel).toBe("claude-sonnet-5-5")
    })

    it("lists what blocks-core declares for every AI node step, sorted by id", () => {
        const picker = modelPickerOf("en", { anthropic: true, openrouter: false })

        expect(picker.choices.every((choice) => choice.available)).toBe(true)
        expect(picker.nodes.find((node) => node.nodeId === "sales.payment-short")).toEqual({
            nodeId: "sales.payment-short",
            model: INSTALLED.nodeModelOf("sales.payment-short")?.model,
            weight: "light",
        })
        expect(picker.nodes.map((node) => node.nodeId)).toEqual([...picker.nodes.map((node) => node.nodeId)].sort())
    })
})
