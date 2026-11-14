import { INSTALLED } from "@modules/domain/installed-plugins"
import { aiCallLabelOf } from "./ai-call-label.policy"

/** The title an installed step declares, in both languages. */
interface DeclaredTitle {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** The title an installed step declares, in both languages (a step whose title is a bilingual text); null for any other step. */
const declaredTitleOf = (nodeId: string): DeclaredTitle | null => {
    const title = INSTALLED.stepOf(nodeId)?.title
    return title !== undefined && "vi" in title ? title : null
}

describe("aiCallLabelOf", () => {
    it("names a node's call by the title of the installed step, in both languages", () => {
        const title = declaredTitleOf("chatbot.answer")
        expect(title).not.toBeNull()
        expect(aiCallLabelOf("chatbot.answer:answer", "vi")).toBe(title?.vi)
        expect(aiCallLabelOf("chatbot.answer:answer", "en")).toBe(title?.en)
        expect(title?.vi).not.toBe(title?.en)
    })

    it("names the call of a step whose title is written as a key by the words its plugin gives that step", () => {
        expect(aiCallLabelOf("sales.consult-stage:stage", "vi")).toBe("Chuy\u1ec3n giai \u0111o\u1ea1n t\u01b0 v\u1ea5n")
        expect(aiCallLabelOf("sales.consult-stage:stage", "en")).toBe("Move the consult stage")
    })

    it("names the engine's own call and the app's fixed tasks by the core words", () => {
        expect(aiCallLabelOf("engine:step-trouble", "en")).toBe("Handling a stuck step")
        expect(aiCallLabelOf("embedding", "en")).toBe("Meaning search")
        expect(aiCallLabelOf("setup", "vi")).toBe("C\u00e0i \u0111\u1eb7t agent")
    })

    it("answers null for a kind no step and no core word names", () => {
        expect(aiCallLabelOf("shop.own-node:x", "vi")).toBeNull()
        expect(aiCallLabelOf("whatever", "en")).toBeNull()
    })
})
