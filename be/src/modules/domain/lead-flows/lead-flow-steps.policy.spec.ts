import {
    composeAsk,
    effectiveConfidence,
    escalationFromText,
    escalationOf,
    flagsOf,
    handoffNeed,
    MIN_CONFIDENCE,
    nextStep,
    parseAnalysis,
    recordAnswer,
    windowStatus,
} from "./lead-flow-steps.policy"
import type { EscalationInput } from "./lead-flow-steps.policy"
import type { Answer, EscalationReason, Flags, HandoffPack, StepInput } from "./lead-flows.contracts"

const noFlags: Flags = { complaint: false, refund: false, angry: false, asks_real_person: false }
const escalationInput = (patch: Partial<EscalationInput> = {}): EscalationInput => ({
    text: "I'd like more information",
    flags: noFlags,
    confidence: 0.9,
    aiFailed: false,
    ...patch,
})
const stepInput = (patch: Partial<StepInput> = {}): StepInput => ({
    state: "qualifying",
    kind: "dm",
    questions: [],
    asked: 0,
    score: { level: "warm", reasons: [], missing: [] },
    handoffOk: false,
    canMessage: true,
    contactKnown: false,
    contactAsked: false,
    greeted: true,
    ...patch,
})
const answer = (i: number, text: string): Answer => ({ i, question: `Question ${i}?`, answer: text, at: "2026-10-14" })
const handoffPack = (patch: Partial<HandoffPack> = {}): HandoffPack => ({
    need: "A kitchen renovation",
    score: { level: "hot", reasons: ["need", "contact"], missing: [] },
    answers: [answer(0, "Next month"), answer(1, "A large kitchen")],
    sourceLine: "Facebook lead form 42",
    lastUserAt: "2026-10-14T09:30:00Z",
    labels: { answers: "Answers", score: "Score", source: "Source", lastMessage: "Last message" },
    ...patch,
})

describe("lead-flow-steps.policy", () => {
    describe("escalationFromText", () => {
        it.each<readonly [string, EscalationReason | null]>([
            ["  \n\t", null],
            ["I'd like more information", null],
            ["T\u00f4i mu\u1ed1n HO\u00c0N TI\u1ec0N", "refund"],
            ["I have a complaint", "complaint"],
            ["This is unacceptable", "angry"],
            ["Are you a human?", "real_person"],
            ["refund and complaint and angry; talk to a human", "refund"],
            ["complaint: worst; are you a bot?", "complaint"],
            ["I am angry, are you a real person?", "angry"],
            ["The refundable item arrived", null],
        ])("reads %p as %p", (text, expected) => {
            expect(escalationFromText(text)).toBe(expected)
        })
    })

    describe("escalationOf", () => {
        it("uses the text reason ahead of flags, AI failure and confidence", () => {
            expect(
                escalationOf(
                    escalationInput({
                        text: "I have a complaint",
                        flags: { ...noFlags, refund: true },
                        aiFailed: true,
                        confidence: 0,
                    }),
                ),
            ).toBe("complaint")
        })

        it.each<readonly [Flags, EscalationReason]>([
            [{ complaint: true, refund: true, angry: true, asks_real_person: true }, "refund"],
            [{ ...noFlags, complaint: true, angry: true, asks_real_person: true }, "complaint"],
            [{ ...noFlags, angry: true, asks_real_person: true }, "angry"],
            [{ ...noFlags, asks_real_person: true }, "real_person"],
        ])("prioritizes flags %p as %p", (flags, expected) => {
            expect(escalationOf(escalationInput({ flags, aiFailed: true, confidence: 0 }))).toBe(expected)
        })

        it("hands over unreadable turns before considering their confidence", () => {
            expect(escalationOf(escalationInput({ flags: null, aiFailed: true, confidence: 0 }))).toBe("unreadable")
        })

        it.each<readonly [number | null, EscalationReason | null]>([
            [null, null],
            [MIN_CONFIDENCE - 0.01, "low_confidence"],
            [MIN_CONFIDENCE, null],
            [1, null],
        ])("uses the confidence boundary for %p", (confidence, expected) => {
            expect(escalationOf(escalationInput({ flags: null, confidence }))).toBe(expected)
        })
    })

    describe("flagsOf", () => {
        it.each<readonly [EscalationReason, Flags]>([
            ["complaint", { ...noFlags, complaint: true }],
            ["refund", { ...noFlags, refund: true }],
            ["angry", { ...noFlags, angry: true }],
            ["real_person", { ...noFlags, asks_real_person: true }],
            ["low_confidence", noFlags],
            ["negative_comment", noFlags],
            ["unreadable", noFlags],
        ])("maps %p to its keyword flags", (reason, expected) => {
            expect(flagsOf(reason)).toEqual(expected)
        })
    })

    describe("parseAnalysis", () => {
        it("uses safe values when the model returns no usable fields", () => {
            expect(parseAnalysis(null, "turn-1")).toEqual({
                turn: "turn-1",
                signals: {
                    need: null,
                    contact: null,
                    budget: "unknown",
                    timeline: "unknown",
                    area: "unknown",
                    asks_price_or_schedule: false,
                    wants_meeting: false,
                    interest: "medium",
                },
                sentiment: "neutral",
                flags: noFlags,
                confidence: 0.5,
                reply: "",
                answer: null,
                knowledge_gap: null,
                public_reply: "",
                private_reply: "",
            })
        })

        it("cleans the model's fields and retains the caller's turn key", () => {
            expect(
                parseAnalysis(
                    {
                        turn: "untrusted-turn",
                        signals: {
                            need: "  Kitchen work  ",
                            contact: "  BUYER@EXAMPLE.COM  ",
                            budget: "fit",
                            timeline: "soon",
                            area: "fit",
                            asks_price_or_schedule: true,
                            wants_meeting: true,
                            interest: "high",
                        },
                        sentiment: "positive",
                        flags: { complaint: true, refund: true, angry: true, asks_real_person: true },
                        confidence: 0.8,
                        reply: "  Certainly  ",
                        answer: "  Next month  ",
                        knowledge_gap: { question: "  Is oak available?  ", topic: "  cabinet | material  " },
                        public_reply: "  Please send a message  ",
                        private_reply: "  How can we help?  ",
                    },
                    "turn-2",
                ),
            ).toEqual({
                turn: "turn-2",
                signals: {
                    need: "Kitchen work",
                    contact: "buyer@example.com",
                    budget: "fit",
                    timeline: "soon",
                    area: "fit",
                    asks_price_or_schedule: true,
                    wants_meeting: true,
                    interest: "high",
                },
                sentiment: "positive",
                flags: { complaint: true, refund: true, angry: true, asks_real_person: true },
                confidence: 0.8,
                reply: "Certainly",
                answer: "Next month",
                knowledge_gap: { question: "Is oak available?", topic: "cabinet | material" },
                public_reply: "Please send a message",
                private_reply: "How can we help?",
            })
        })

        it("clips each reply, answer and knowledge field to its own limit", () => {
            expect(
                parseAnalysis(
                    {
                        reply: "r".repeat(701),
                        answer: "a".repeat(301),
                        knowledge_gap: { question: "q".repeat(301), topic: "t".repeat(121) },
                        public_reply: "u".repeat(301),
                        private_reply: "p".repeat(701),
                    },
                    "turn-long",
                ),
            ).toMatchObject({
                reply: `${"r".repeat(699)}…`,
                answer: `${"a".repeat(299)}…`,
                knowledge_gap: { question: `${"q".repeat(299)}…`, topic: `${"t".repeat(119)}…` },
                public_reply: `${"u".repeat(299)}…`,
                private_reply: `${"p".repeat(699)}…`,
            })
        })

        it.each<readonly [unknown, number]>([
            [-0.1, 0],
            [1.1, 1],
            [Number.NaN, 0.5],
            [Number.POSITIVE_INFINITY, 0.5],
            ["0.9", 0.5],
        ])("clamps or defaults confidence %p", (confidence, expected) => {
            expect(parseAnalysis({ confidence }, "confidence-turn").confidence).toBe(expected)
        })

        it("accepts negative sentiment and rejects truthy values that are not flag booleans", () => {
            expect(
                parseAnalysis(
                    {
                        sentiment: "negative",
                        flags: { complaint: "true", refund: 1, angry: {}, asks_real_person: "yes" },
                        knowledge_gap: { question: " ", topic: "unused" },
                        answer: " ",
                    },
                    "negative-turn",
                ),
            ).toMatchObject({ sentiment: "negative", flags: noFlags, knowledge_gap: null, answer: null })
        })
    })

    describe("effectiveConfidence", () => {
        it("keeps confidence when there is no knowledge gap", () => {
            expect(effectiveConfidence({ confidence: 0.9, knowledge_gap: null })).toBe(0.9)
        })

        it.each<readonly [number, number]>([
            [0.9, MIN_CONFIDENCE - 0.05],
            [0.3, 0.3],
        ])("caps a gap's confidence %p without raising a lower value", (confidence, expected) => {
            expect(effectiveConfidence({ confidence, knowledge_gap: { question: "Why?", topic: "topic" } })).toBe(
                expected,
            )
        })
    })

    describe("windowStatus", () => {
        const day = 86_400_000

        it("closes when the person has never messaged", () => {
            expect(windowStatus(null, day)).toEqual({ status: "closed", msLeft: 0 })
        })

        it.each<readonly [number, string, number]>([
            [0, "open", day],
            [day, "open", 0],
            [day + 1, "tag_only", 6 * day - 1],
            [7 * day, "tag_only", 0],
            [7 * day + 1, "closed", 0],
        ])("reports the message window at age %p", (age, status, msLeft) => {
            expect(windowStatus(100, 100 + age)).toEqual({ status, msLeft })
        })
    })

    describe("recordAnswer", () => {
        it("replaces the matching question, trims its answer and sorts without changing the input", () => {
            const answers = [answer(2, "Third"), answer(0, "Old first"), answer(1, "Second")]
            expect(recordAnswer(answers, answer(0, "  New first  "))).toEqual([
                answer(0, "New first"),
                answer(1, "Second"),
                answer(2, "Third"),
            ])
            expect(answers).toEqual([answer(2, "Third"), answer(0, "Old first"), answer(1, "Second")])
        })

        it("clips a new answer to 500 characters", () => {
            expect(recordAnswer([], answer(0, ` ${"a".repeat(501)} `))).toEqual([answer(0, `${"a".repeat(499)}…`)])
        })
    })

    describe("nextStep", () => {
        it.each<readonly [Partial<StepInput>, string, number]>([
            [{ state: "escalated", handoffOk: true, score: { level: "hot", reasons: [], missing: [] } }, "hold", 0],
            [{ state: "handed_off", canMessage: false }, "hold", 0],
            [{ handoffOk: true, score: { level: "hot", reasons: [], missing: [] }, canMessage: false }, "handoff", 0],
            [{ handoffOk: false, score: { level: "hot", reasons: [], missing: [] } }, "ask_contact", 0],
            [{ canMessage: false, score: { level: "cold", reasons: [], missing: [] } }, "close", 0],
            [{ canMessage: false }, "follow_up", 0],
            [{ score: { level: "cold", reasons: ["not interested"], missing: [] }, greeted: false }, "close", 0],
            [{ state: "new", greeted: false }, "greet", 0],
            [{ state: "new", kind: "comment", greeted: false }, "ask_contact", 0],
            [{ greeted: false }, "ask_contact", 0],
            [{ questions: ["First?", "Second?", "Third?"], asked: 1 }, "ask", 1],
            [{ questions: ["One?", "Two?", "Three?", "Four?", "Five?"], asked: 4 }, "follow_up", 0],
            [{ contactKnown: true }, "follow_up", 0],
            [{ contactAsked: true }, "follow_up", 0],
            [{ asked: 4 }, "follow_up", 0],
            [{ score: { level: "cold", reasons: ["low interest"], missing: [] } }, "close", 0],
            [{}, "ask_contact", 0],
        ])("decides %p as %p", (patch, expected, index) => {
            expect(nextStep(stepInput(patch))).toEqual({ step: expected, index })
        })
    })

    describe("composeAsk", () => {
        it.each<readonly [string, string, string, string]>([
            ["  We can help  ", "  When do you need it?  ", "Thanks", "We can help\n\nWhen do you need it?"],
            ["  ", "  What size?  ", "Thanks", "Thanks\n\nWhat size?"],
            ["Reply", " ", "Thanks", "Reply"],
            ["", "Question?", "", "Question?"],
            ["", "", "", ""],
        ])("combines the reply and question for %p", (reply, question, thanks, expected) => {
            expect(composeAsk({ reply, question, thanks })).toBe(expected)
        })
    })

    describe("handoffNeed", () => {
        it("formats the need, all answers, reasons, source and last message with supplied labels", () => {
            expect(handoffNeed(handoffPack())).toBe(
                "A kitchen renovation\nAnswers: Question 0? → Next month | Question 1? → A large kitchen\nScore: hot (need, contact)\nSource: Facebook lead form 42\nLast message: 2026-10-14T09:30:00Z",
            )
        })

        it("omits missing need, answers and last message while retaining score and source", () => {
            expect(handoffNeed(handoffPack({ need: null, answers: [], lastUserAt: null }))).toBe(
                "Score: hot (need, contact)\nSource: Facebook lead form 42",
            )
        })

        it("limits the complete Sales note to 900 characters", () => {
            expect(handoffNeed(handoffPack({ need: "n".repeat(901) }))).toBe("n".repeat(900))
        })
    })
})
