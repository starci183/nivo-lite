import { Test } from "@nestjs/testing"
import type { DivertSource } from "./work-divert.policy"
import { divertSpecOf } from "./work-divert.policy"

/** The members of the subject under test. */
interface Subject {
    readonly divertSpecOf: typeof divertSpecOf
}

const SUBJECT = Symbol("work-divert.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { divertSpecOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const SOURCE: DivertSource = {
    key: "m1",
    subjectType: "conversation",
    subjectId: "conv-1",
    leadId: "lead-1",
    installationId: "inst-1",
    origin: { turnId: "turn-1", wakeId: "wake-1" },
    proposal: { summary: "Reply", draft: "Hello", fields: { question: "Hi" } },
}

const HAND = { action: "hand_over_conversation", handoverTo: "support", asks: false }

describe("work-divert.policy divertSpecOf", () => {
    it("starts the action of the branch on the same subject, preset and with no chain, keyed on what it diverts", async () => {
        const subject = await build()

        expect(subject.divertSpecOf(HAND, SOURCE)).toEqual({
            action: "hand_over_conversation",
            subject_type: "conversation",
            subject_id: "conv-1",
            lead_id: "lead-1",
            dedupeKey: "graph:m1:hand_over_conversation",
            preset: true,
            noChain: true,
            installationId: "inst-1",
            origin: { turnId: "turn-1", wakeId: "wake-1" },
            seed: {
                summary: "Reply",
                draft: "Hello",
                fields: { question: "Hi", conversation_id: "conv-1", to: "support" },
            },
        })
    })

    it("makes a person decide the diverted work when the path went through an approval", async () => {
        const subject = await build()

        expect(subject.divertSpecOf({ ...HAND, asks: true }, SOURCE)).toMatchObject({ forceAsk: "branch_ask" })
        expect(subject.divertSpecOf(HAND, SOURCE)).not.toHaveProperty("forceAsk")
    })

    it("leaves out the target when the node names none, and the origin when the work has none", async () => {
        const subject = await build()

        const spec = subject.divertSpecOf({ ...HAND, handoverTo: null }, { ...SOURCE, origin: null })

        expect(spec.seed?.fields).toEqual({ question: "Hi", conversation_id: "conv-1" })
        expect(spec).not.toHaveProperty("origin")
    })

    it("names the conversation only for a subject that is one, and keeps the fields of a proposal that has none", async () => {
        const subject = await build()

        const spec = subject.divertSpecOf(HAND, {
            ...SOURCE,
            subjectType: "order",
            subjectId: "order-1",
            leadId: null,
            proposal: { summary: "Order" },
        })

        expect(spec).toMatchObject({ subject_type: "order", subject_id: "order-1", lead_id: null })
        expect(spec.seed).toEqual({ summary: "Order", fields: { to: "support" } })
    })
})
