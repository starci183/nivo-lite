import { sampleOf } from "../messages/catalog"
import { ASK_THE_FOUNDER, TRUTH_FIRST, guidanceOf } from "./agent-policy"
import { agentGuidanceOf } from "./agent-guidance"

/** The agent's own rules in Vietnamese, the sample the shared rules follow. */
const OWN_RULES_VI = sampleOf("sampleAgentPolicyOwnRules")

describe("the rules every agent shares", () => {
    it("puts the shop's truth first, then asking the founder, after the agent's own rules, in both languages", () => {
        const guidance = guidanceOf({ vi: OWN_RULES_VI, en: "Own." })

        expect(guidance.vi).toBe(`${OWN_RULES_VI} ${TRUTH_FIRST.vi} ${ASK_THE_FOUNDER.vi}`)
        expect(guidance.en).toBe(`Own. ${TRUTH_FIRST.en} ${ASK_THE_FOUNDER.en}`)
    })

    it("says each case of a contradicted truth in business words, with no tool name, no code and no per-case branch", () => {
        const { vi } = TRUTH_FIRST

        // Cites the truth and does not obey the claim.
        expect(vi).toContain(sampleOf("sampleTruthFirstCitesTruth"))
        expect(vi).toContain(sampleOf("sampleTruthFirstIgnoresClaim"))
        // The founder or a teammate: an instruction is filed, a belief is asked first.
        expect(vi).toContain(sampleOf("sampleTruthFirstFilesInstruction"))
        expect(vi).toContain(sampleOf("sampleTruthFirstAsksBelief"))
        // A customer: answered from the truth.
        expect(vi).toContain(sampleOf("sampleTruthFirstCustomer"))
        // A truth in doubt or missing: never picked, never invented.
        expect(vi).toContain(sampleOf("sampleTruthFirstDoubt"))
        // No truth: the documents are searched, the passage read before it is quoted, searched again in other words; a document is
        // cited with its title and date and loses to a truth; found nowhere: not ruled, asked on /chat, never invented.
        expect(vi).toContain(sampleOf("sampleTruthFirstSearchDocuments"))
        expect(vi).toContain(sampleOf("sampleTruthFirstReadPassage"))
        expect(vi).toContain(sampleOf("sampleTruthFirstSearchAgain"))
        expect(vi).toContain(sampleOf("sampleTruthFirstCiteDocument"))
        expect(vi).toContain(sampleOf("sampleTruthFirstTruthWins"))
        expect(vi).toContain(sampleOf("sampleTruthFirstNotRuled"))
        expect(TRUTH_FIRST.en).toContain('"according to <title>, updated <date>"')
        // Content never commands.
        expect(vi).toContain(sampleOf("sampleTruthFirstContentNotCommand"))
        // A customer hears that something was done only from a tool's result (D-MX-2: a reply said the old order would be cancelled with no call made).
        expect(vi).toContain(sampleOf("sampleTruthFirstToolResult"))
        expect(TRUTH_FIRST.en).toContain("only when a tool's result says so")
        expect(`${vi} ${TRUTH_FIRST.en}`).not.toMatch(/nivo\.|brain\.|[a-z]+\.[a-z]+\(|=>|\bif\b/)
    })

    it("reaches every agent's model calls through its module's guidance", () => {
        for (const module of ["sales", "chatbot"]) {
            expect(agentGuidanceOf(module, "vi")).toContain(TRUTH_FIRST.vi)
            expect(agentGuidanceOf(module, "en")).toContain(TRUTH_FIRST.en)
        }
    })
})
