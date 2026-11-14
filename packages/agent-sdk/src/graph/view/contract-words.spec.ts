import { AI_CALL_WORDS, aiCallLabelWith } from "./ai-call-label"
import { contractViewsOf } from "./contract-view"
import {
    CONDITION_WORDS,
    CONTRACT_PROBLEM_WORDS,
    CONTRACT_TYPE_WORDS,
    ENTRY_WORDS,
    PATH_SEPARATOR_WORDS,
    TRIGGER_SOURCE_WORDS,
    contractWordsOf,
} from "./contract-words"

const views = contractViewsOf(
    contractWordsOf({
        agentLabel: (agent, locale) => (agent === "sales" ? { vi: "B\u00e1n h\u00e0ng", en: "Sales" }[locale] : undefined),
        paramLabel: (name, locale) => (name === "orderId" ? { vi: "M\u00e3 \u0111\u01a1n", en: "Order id" }[locale] : undefined),
    }),
)

describe("the words of the workflow contract's own vocabulary", () => {
    it("have a Vietnamese and an English text for every kind, rule, type, operator and problem", () => {
        const all = [
            ...Object.values(TRIGGER_SOURCE_WORDS),
            ...Object.values(ENTRY_WORDS),
            ...Object.values(CONTRACT_TYPE_WORDS),
            ...Object.values(CONDITION_WORDS),
            ...Object.values(CONTRACT_PROBLEM_WORDS),
        ]
        // 22 -> 20 problem words: R35 / R43 deleted the conversation hold (`ENTRY_HOLD_WITHOUT_CONVERSATION`) and a second contract problem code
        // with it; the table is typed by `ContractProblem["code"]`, so a word for a code that no longer exists cannot stay. Every kept code still has both texts (checked below).
        expect(all).toHaveLength(11 + 2 + 6 + 5 + 20)
        for (const text of all) {
            expect(text.vi.trim()).not.toBe("")
            expect(text.en.trim()).not.toBe("")
        }
    })

    it("join the plugin's names into a problem text, a param by its words and a path member by member", () => {
        expect(views.paramLabelOf("orderId", "en")).toBe("Order id")
        expect(views.paramLabelOf("orderId.other", "vi")).toBe(`M\u00e3 \u0111\u01a1n${PATH_SEPARATOR_WORDS.vi}other`)
        expect(views.contractProblemText({ code: "CALL_INPUT_MISSING", at: "step.orderId" }, "en", { step: "Hand off" })).toContain(
            "Order id",
        )
    })
})

describe("aiCallLabelWith", () => {
    const titles: Readonly<Record<string, string>> = { "chatbot.answer": "Answer" }
    const titleOf = (node: string): string | null => titles[node] ?? null

    it("names a node call by the title its declaration gives", () => {
        expect(aiCallLabelWith("chatbot.answer:answer", "vi", titleOf)).toBe("Answer")
    })

    it("names the engine's own calls and the fixed tasks by the core words, and answers null for a kind with none", () => {
        expect(aiCallLabelWith("engine:step-trouble", "en", titleOf)).toBe("Handling a stuck step")
        expect(aiCallLabelWith("embedding", "vi", titleOf)).toBe(AI_CALL_WORDS.Embedding?.vi)
        expect(aiCallLabelWith("shop.own-node:x", "vi", titleOf)).toBeNull()
        expect(aiCallLabelWith("toString", "vi", titleOf)).toBeNull()
    })
})
