import { Test } from "@nestjs/testing"
import {
    agentHandoffOf as realAgentHandoffOf,
    approvalOf as realApprovalOf,
    clipText as realClipText,
    handoffReasonOf as realHandoffReasonOf,
    leadOf as realLeadOf,
    queryOf as realQueryOf,
} from "./tool-args.policy"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"

const SUBJECT = Symbol("tool-args.policy")
type Subject = Pick<
    typeof import("./tool-args.policy"),
    "agentHandoffOf" | "approvalOf" | "clipText" | "handoffReasonOf" | "leadOf" | "queryOf"
>
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    agentHandoffOf: realAgentHandoffOf,
                    approvalOf: realApprovalOf,
                    clipText: realClipText,
                    handoffReasonOf: realHandoffReasonOf,
                    leadOf: realLeadOf,
                    queryOf: realQueryOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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

describe("tool args policy > clipText", () => {
    it("trims and clips a text", async () => {
        const subject = await build()
        expect(subject.clipText("  abcdef  ", 3)).toBe("abc")
    })

    it("answers an empty text for a value that is not a text", async () => {
        const subject = await build()
        expect(subject.clipText(42, 3)).toBe("")
    })
})

describe("tool args policy > queryOf", () => {
    it("clips the query to 400 characters", async () => {
        const subject = await build()
        expect(subject.queryOf({ query: "q".repeat(500) })).toBe("q".repeat(400))
    })

    it("requires a query", async () => {
        const subject = await build()
        const error = thrownBy(() => subject.queryOf({ query: "   " }))

        expect(error?.code).toBe(AgentToolsErrorCode.ArgumentMissing)
        expect(error?.params).toEqual({ field: "query" })
    })
})

describe("tool args policy > leadOf", () => {
    it("takes the phone as the contact and keeps the company", async () => {
        const subject = await build()
        expect(
            subject.leadOf({ contact_name: "An", need: "a quote", company: "Acme", phone: "0900", email: "an@x.test" }),
        ).toEqual({ contactName: "An", need: "a quote", company: "Acme", contact: "0900" })
    })

    it("falls back to the email, and to null when there is no contact or company", async () => {
        const subject = await build()
        expect(subject.leadOf({ contact_name: "An", need: "a quote", email: "an@x.test" })).toEqual({
            contactName: "An",
            need: "a quote",
            company: null,
            contact: "an@x.test",
        })
        expect(subject.leadOf({ contact_name: "An", need: "a quote" }).contact).toBeNull()
    })

    it("clips the name, need, company, phone and email", async () => {
        const subject = await build()
        const lead = subject.leadOf({
            contact_name: "n".repeat(200),
            need: "d".repeat(900),
            company: "c".repeat(200),
            phone: "9".repeat(80),
        })

        expect(lead.contactName).toHaveLength(120)
        expect(lead.need).toHaveLength(600)
        expect(lead.company).toHaveLength(120)
        expect(lead.contact).toHaveLength(40)
        expect(subject.leadOf({ contact_name: "A", need: "B", email: "e".repeat(300) }).contact).toHaveLength(120)
    })

    it("requires the name and then the need", async () => {
        const subject = await build()
        expect(thrownBy(() => subject.leadOf({ need: "x" }))?.params).toEqual({ field: "contact_name" })
        expect(thrownBy(() => subject.leadOf({ contact_name: "An" }))?.params).toEqual({ field: "need" })
    })
})

describe("tool args policy > approvalOf", () => {
    it("keeps unclear_outcome and the proposed answer", async () => {
        const subject = await build()
        expect(subject.approvalOf({ question: "Price?", proposed_answer: "100", reason: "unclear_outcome" })).toEqual({
            question: "Price?",
            proposedAnswer: "100",
            reason: "unclear_outcome",
        })
    })

    it("treats any other reason as over_authority and an empty answer as none", async () => {
        const subject = await build()
        expect(subject.approvalOf({ question: "Price?", reason: "because" })).toEqual({
            question: "Price?",
            proposedAnswer: null,
            reason: "over_authority",
        })
    })

    it("clips the question to 500 and the answer to 1500", async () => {
        const subject = await build()
        const request = subject.approvalOf({ question: "q".repeat(600), proposed_answer: "a".repeat(2000) })

        expect(request.question).toHaveLength(500)
        expect(request.proposedAnswer).toHaveLength(1500)
    })

    it("requires a question", async () => {
        const subject = await build()
        expect(thrownBy(() => subject.approvalOf({}))?.params).toEqual({ field: "question" })
    })
})

describe("tool args policy > handoffReasonOf", () => {
    it("clips the reason to 300 and allows none", async () => {
        const subject = await build()
        expect(subject.handoffReasonOf({ reason: "r".repeat(400) })).toHaveLength(300)
        expect(subject.handoffReasonOf({})).toBe("")
    })
})

describe("tool args policy > agentHandoffOf", () => {
    it("clips the target to 120 and the note to 400", async () => {
        const subject = await build()
        const request = subject.agentHandoffOf({ to: ` ${"t".repeat(200)} `, note: "n".repeat(500) })

        expect(request.to).toHaveLength(120)
        expect(request.note).toHaveLength(400)
    })

    it("requires the target and the note", async () => {
        const subject = await build()
        expect(thrownBy(() => subject.agentHandoffOf({ note: "x" }))?.params).toEqual({ field: "to" })
        expect(thrownBy(() => subject.agentHandoffOf({ to: "care" }))?.params).toEqual({ field: "note" })
    })
})
