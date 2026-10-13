import { approvalOf, clipText, handoffReasonOf, leadOf, queryOf } from "./tool-args.policy"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"

/** The error a call throws, so a spec can read its code and params. */
const thrownBy = (run: () => unknown): AgentToolsError | null => {
    try {
        run()
        return null
    } catch (cause) {
        if (cause instanceof AgentToolsError) return cause
        throw cause
    }
}

describe("tool args policy", () => {
    describe("clipText", () => {
        it("trims and clips a text", () => {
            expect(clipText("  abcdef  ", 3)).toBe("abc")
        })

        it("answers an empty text for a value that is not a text", () => {
            expect(clipText(42, 3)).toBe("")
        })
    })

    describe("queryOf", () => {
        it("clips the query to 400 characters", () => {
            expect(queryOf({ query: "q".repeat(500) })).toBe("q".repeat(400))
        })

        it("requires a query", () => {
            const error = thrownBy(() => queryOf({ query: "   " }))

            expect(error?.code).toBe(AgentToolsErrorCode.ArgumentMissing)
            expect(error?.params).toEqual({ field: "query" })
        })
    })

    describe("leadOf", () => {
        it("takes the phone as the contact and keeps the company", () => {
            expect(
                leadOf({ contact_name: "An", need: "a quote", company: "Acme", phone: "0900", email: "an@x.test" }),
            ).toEqual({ contactName: "An", need: "a quote", company: "Acme", contact: "0900" })
        })

        it("falls back to the email, and to null when there is no contact or company", () => {
            expect(leadOf({ contact_name: "An", need: "a quote", email: "an@x.test" })).toEqual({
                contactName: "An",
                need: "a quote",
                company: null,
                contact: "an@x.test",
            })
            expect(leadOf({ contact_name: "An", need: "a quote" }).contact).toBeNull()
        })

        it("clips the name, need, company, phone and email", () => {
            const lead = leadOf({
                contact_name: "n".repeat(200),
                need: "d".repeat(900),
                company: "c".repeat(200),
                phone: "9".repeat(80),
            })

            expect(lead.contactName).toHaveLength(120)
            expect(lead.need).toHaveLength(600)
            expect(lead.company).toHaveLength(120)
            expect(lead.contact).toHaveLength(40)
            expect(leadOf({ contact_name: "A", need: "B", email: "e".repeat(300) }).contact).toHaveLength(120)
        })

        it("requires the name and then the need", () => {
            expect(thrownBy(() => leadOf({ need: "x" }))?.params).toEqual({ field: "contact_name" })
            expect(thrownBy(() => leadOf({ contact_name: "An" }))?.params).toEqual({ field: "need" })
        })
    })

    describe("approvalOf", () => {
        it("keeps unclear_outcome and the proposed answer", () => {
            expect(approvalOf({ question: "Price?", proposed_answer: "100", reason: "unclear_outcome" })).toEqual({
                question: "Price?",
                proposedAnswer: "100",
                reason: "unclear_outcome",
            })
        })

        it("treats any other reason as over_authority and an empty answer as none", () => {
            expect(approvalOf({ question: "Price?", reason: "because" })).toEqual({
                question: "Price?",
                proposedAnswer: null,
                reason: "over_authority",
            })
        })

        it("clips the question to 500 and the answer to 1500", () => {
            const request = approvalOf({ question: "q".repeat(600), proposed_answer: "a".repeat(2000) })

            expect(request.question).toHaveLength(500)
            expect(request.proposedAnswer).toHaveLength(1500)
        })

        it("requires a question", () => {
            expect(thrownBy(() => approvalOf({}))?.params).toEqual({ field: "question" })
        })
    })

    describe("handoffReasonOf", () => {
        it("clips the reason to 300 and allows none", () => {
            expect(handoffReasonOf({ reason: "r".repeat(400) })).toHaveLength(300)
            expect(handoffReasonOf({})).toBe("")
        })
    })
})
