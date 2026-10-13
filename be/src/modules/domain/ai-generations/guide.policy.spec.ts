import { builder } from "@starci/jest-preset"
import type { GuideAsk, GuideWords } from "./ai-generations.contracts"
import { GUIDE_HISTORY_TURNS, GUIDE_QUESTION_MAX, guideAskerKey, guidePrompt } from "./guide.policy"

const askOf = builder<GuideAsk>({
    workspaceId: "w1",
    question: "How do I invite staff?",
    path: "/leads/42",
    history: [],
    locale: "en",
})
const WORDS: GuideWords = { text: (key) => `[${key}]` }

const userLine = (ask: GuideAsk, isManager: boolean): string => guidePrompt(ask, isManager, WORDS)[1]?.content ?? ""

describe("guidePrompt", () => {
    it("lists the manager-only pages to a manager and hides them from staff", () => {
        expect(userLine(askOf(), true)).toContain("- billing |")
        expect(userLine(askOf(), false)).not.toContain("- billing |")
        expect(userLine(askOf(), false)).toContain("- leads |")
    })

    it("names the page the member is on, by the longest matching path", () => {
        expect(userLine(askOf(), false)).toContain("CURRENT PAGE: leads ([guide.page.leads.title])")
        expect(userLine(askOf({ path: "/nowhere" }), false)).toContain("CURRENT PAGE: /nowhere")
    })

    it("keeps only the last turns and bounds the question", () => {
        const history = Array.from({ length: 10 }, (_, index) => ({ role: "user" as const, text: `turn ${index}` }))
        const line = userLine(askOf({ history, question: "x".repeat(GUIDE_QUESTION_MAX + 50) }), true)

        expect(line).not.toContain("turn 3")
        expect(line).toContain(`turn ${10 - 1}`)
        expect(line.split("User: turn").length - 1).toBe(GUIDE_HISTORY_TURNS)
        expect(line).toContain(`QUESTION: ${"x".repeat(GUIDE_QUESTION_MAX)}`)
        expect(line).not.toContain("x".repeat(GUIDE_QUESTION_MAX + 1))
    })

    it("tells the model who is asking and how to reply", () => {
        const [system] = guidePrompt(askOf(), false, WORDS)

        expect(system?.role).toBe("system")
        expect(system?.content).toContain("[guide.audienceStaff]")
        expect(system?.content).toContain("[guide.replyFormat]")
    })
})

describe("guideAskerKey", () => {
    it("names the member of the workspace", () => {
        expect(guideAskerKey("w1", "u1")).toBe("guide:w1:u1")
    })
})
