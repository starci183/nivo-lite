import { mock } from "@starci/jest-preset"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { FairnessViolation } from "../hiring.contracts"
import { fairnessMessage } from "./fairness-message.policy"

const text = (key: string, params: Readonly<Record<string, string | number>>): string =>
    `${key}${JSON.stringify(params)}`

const build = () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const textOf = (key: string, params: Readonly<Record<string, string | number>>): string =>
        catalog.get(key, params, "vi")
    return { catalog, textOf }
}

describe("hiring fairness message policy", () => {
    it("renders an empty refusal with advice and no additional count", () => {
        const { catalog, textOf } = build()

        expect(fairnessMessage([], textOf)).toBe(
            text("hiring.fairness.refusal", { parts: "", more: "", advice: "hiring.fairness.advice{}" }),
        )
        expect(catalog.get.mock.calls).toEqual([
            ["hiring.fairness.advice", {}, "vi"],
            ["hiring.fairness.refusal", { parts: "", more: "", advice: "hiring.fairness.advice{}" }, "vi"],
        ])
    })

    it("quotes the excerpt and category with a field label only when supplied", () => {
        const { catalog, textOf } = build()
        const violations: Array<FairnessViolation> = [
            { category: "age", excerpt: "20 tuoi", field: "title" },
            { category: "gender", excerpt: "nu", field: "" },
        ]
        const parts = `hiring.field.title{}: "20 tuoi" (hiring.fairness.age{}); "nu" (hiring.fairness.gender{})`

        expect(fairnessMessage(violations, textOf)).toBe(
            text("hiring.fairness.refusal", { parts, more: "", advice: "hiring.fairness.advice{}" }),
        )
        expect(catalog.get.mock.calls).toEqual([
            ["hiring.field.title", {}, "vi"],
            ["hiring.fairness.age", {}, "vi"],
            ["hiring.fairness.gender", {}, "vi"],
            ["hiring.fairness.advice", {}, "vi"],
            ["hiring.fairness.refusal", { parts, more: "", advice: "hiring.fairness.advice{}" }, "vi"],
        ])
    })

    it("quotes four violations and reports the exact remaining count", () => {
        const { catalog, textOf } = build()
        const violations: Array<FairnessViolation> = Array.from({ length: 6 }, (_, index) => ({
            category: "age",
            excerpt: `age ${index}`,
            field: "",
        }))
        const parts = `"age 0" (hiring.fairness.age{}); "age 1" (hiring.fairness.age{}); "age 2" (hiring.fairness.age{}); "age 3" (hiring.fairness.age{})`

        expect(fairnessMessage(violations, textOf)).toBe(
            text("hiring.fairness.refusal", {
                parts,
                more: `hiring.fairness.more{"count":2}`,
                advice: "hiring.fairness.advice{}",
            }),
        )
        expect(catalog.get.mock.calls).toEqual([
            ["hiring.fairness.age", {}, "vi"],
            ["hiring.fairness.age", {}, "vi"],
            ["hiring.fairness.age", {}, "vi"],
            ["hiring.fairness.age", {}, "vi"],
            ["hiring.fairness.more", { count: 2 }, "vi"],
            ["hiring.fairness.advice", {}, "vi"],
            [
                "hiring.fairness.refusal",
                { parts, more: `hiring.fairness.more{"count":2}`, advice: "hiring.fairness.advice{}" },
                "vi",
            ],
        ])
    })

    it("does not add a remaining count at exactly four violations", () => {
        const { catalog, textOf } = build()
        const violations: Array<FairnessViolation> = Array.from({ length: 4 }, () => ({
            category: "age",
            excerpt: "20 tuoi",
            field: "",
        }))

        expect(fairnessMessage(violations, textOf)).toBe(
            text("hiring.fairness.refusal", {
                parts: `"20 tuoi" (hiring.fairness.age{}); "20 tuoi" (hiring.fairness.age{}); "20 tuoi" (hiring.fairness.age{}); "20 tuoi" (hiring.fairness.age{})`,
                more: "",
                advice: "hiring.fairness.advice{}",
            }),
        )
        expect(catalog.get.mock.calls.map(([key]) => key)).toEqual([
            "hiring.fairness.age",
            "hiring.fairness.age",
            "hiring.fairness.age",
            "hiring.fairness.age",
            "hiring.fairness.advice",
            "hiring.fairness.refusal",
        ])
    })
})
