import { clip, fold, textOf, textOrNull } from "./lead-flow-identity.policy"
import { MAX_QUESTIONS, cleanSignals, recordOf } from "./lead-flow-score.policy"
import type {
    Analysis,
    Answer,
    ComposeAsk,
    EscalationReason,
    Flags,
    HandoffPack,
    Step,
    StepInput,
    WindowStatus,
} from "./lead-flows.contracts"

/** Below this confidence the bot hands the prospect to a person (the gate's bar). */
export const MIN_CONFIDENCE = 0.6

const DAY_MS = 86_400_000
const WINDOW_MS = DAY_MS
const HUMAN_AGENT_MS = 7 * DAY_MS

/** What the escalation reads from a turn. */
export interface EscalationInput {
    /** The person's text. */
    readonly text: string
    /** The model's flags. */
    readonly flags: Flags | null
    /** The effective confidence. */
    readonly confidence: number | null
    /** The model could not read the turn. */
    readonly aiFailed: boolean
}

const ESCALATION_PATTERNS: ReadonlyArray<readonly [EscalationReason, RegExp]> = [
    ["refund", /\b(hoan tien|tra lai tien|refund|money back|doi tra|boi thuong|compensation|chargeback)\b/],
    [
        "complaint",
        /\b(khieu nai|phan nan|to cao|lua dao|complain|complaint|scam|bao chi|kien|co quan chuc nang|bao cong an|rac|te qua)\b/,
    ],
    [
        "angry",
        /\b(buc minh|buc xuc|tuc gian|qua doi|vo trach nhiem|dm|dcm|vcl|do ngu|ngu qua|cut|angry|furious|worst|terrible|unacceptable|ridiculous)\b/,
    ],
    [
        "real_person",
        /(\b(co phai|la)\s+(nguoi that|nguoi hay may|bot|robot|ai|may)\b|\b(nguoi that|nguoi that khong|nguoi that ko|ban la bot|ban la ai|are you (a )?(real|human|bot|robot|person)|real person|talk to (a )?(human|person|someone)|noi chuyen voi nguoi|gap nguoi that|nhan vien that|cho gap nhan vien)\b)/,
    ],
]

/** Keyword triggers, free of any model call; the first match wins. */
export const escalationFromText = (text: string): EscalationReason | null => {
    const folded = fold(text)
    if (folded === "") return null
    return ESCALATION_PATTERNS.find(([, words]) => words.test(folded))?.[0] ?? null
}

/** The reason to hand over, from the words and the model's reading; null = the bot may continue. */
export const escalationOf = (input: EscalationInput): EscalationReason | null => {
    const byText = escalationFromText(input.text)
    if (byText !== null) return byText
    if (input.flags?.refund === true) return "refund"
    if (input.flags?.complaint === true) return "complaint"
    if (input.flags?.angry === true) return "angry"
    if (input.flags?.asks_real_person === true) return "real_person"
    if (input.aiFailed) return "unreadable"
    if (input.confidence !== null && input.confidence < MIN_CONFIDENCE) return "low_confidence"
    return null
}

/** The flags a keyword escalation stands for. */
export const flagsOf = (reason: EscalationReason): Flags => ({
    complaint: reason === "complaint",
    refund: reason === "refund",
    angry: reason === "angry",
    asks_real_person: reason === "real_person",
})

const confidenceOf = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5

/** Validates and clamps what the model returned; a missing or broken field is the safe value, never a guess. */
export const parseAnalysis = (raw: unknown, turn: string): Analysis => {
    const source = recordOf(raw)
    const flags = recordOf(source.flags)
    const gap = recordOf(source.knowledge_gap)
    const question = textOf(gap.question)
    const sentiment = source.sentiment === "positive" || source.sentiment === "negative" ? source.sentiment : "neutral"
    const answer = textOrNull(source.answer)
    return {
        turn,
        signals: cleanSignals(source.signals),
        sentiment,
        flags: {
            complaint: flags.complaint === true,
            refund: flags.refund === true,
            angry: flags.angry === true,
            asks_real_person: flags.asks_real_person === true,
        },
        confidence: confidenceOf(source.confidence),
        reply: clip(textOf(source.reply), 700),
        answer: answer === null ? null : clip(answer, 300),
        knowledge_gap: question === "" ? null : { question: clip(question, 300), topic: clip(textOf(gap.topic), 120) },
        public_reply: clip(textOf(source.public_reply), 300),
        private_reply: clip(textOf(source.private_reply), 700),
    }
}

/** A question the knowledge could not answer caps the confidence just under the bar. */
export const effectiveConfidence = (analysis: Pick<Analysis, "confidence" | "knowledge_gap">): number =>
    analysis.knowledge_gap === null ? analysis.confidence : Math.min(analysis.confidence, MIN_CONFIDENCE - 0.05)

/** open: a normal message may go; tag_only: only a person's HUMAN_AGENT message; closed: nothing. */
export const windowStatus = (lastUserAt: number | null, now: number): WindowStatus => {
    if (lastUserAt === null) return { status: "closed", msLeft: 0 }
    const age = now - lastUserAt
    if (age <= WINDOW_MS) return { status: "open", msLeft: WINDOW_MS - age }
    if (age <= HUMAN_AGENT_MS) return { status: "tag_only", msLeft: HUMAN_AGENT_MS - age }
    return { status: "closed", msLeft: 0 }
}

/** Stores the answer to a question, replacing an earlier answer to the same question. */
export const recordAnswer = (answers: ReadonlyArray<Answer>, answer: Answer): Array<Answer> =>
    [
        ...answers.filter((existing) => existing.i !== answer.i),
        { ...answer, answer: clip(answer.answer.trim(), 500) },
    ].sort((a, b) => a.i - b.i)

const step = (kind: Step["step"], index = 0): Step => ({ step: kind, index })

/**
 * The state machine's decision after a turn was read and scored, in order: a person is needed elsewhere (escalation is decided before);
 * hot with contact and need goes to Sales; no window means warm follows up through a person and cold closes silently; not interested
 * closes; a first message is greeted; then the next question (at most four), the contact once; then warm follows up and cold closes.
 */
export const nextStep = (input: StepInput): Step => {
    if (input.state === "escalated") return step("hold")
    if (input.state === "handed_off") return step("hold")
    if (input.score.level === "hot" && input.handoffOk) return step("handoff")
    if (!input.canMessage) return step(input.score.level === "cold" ? "close" : "follow_up")
    if (input.score.level === "cold" && input.score.reasons.includes("not interested")) return step("close")
    if (!input.greeted && input.kind === "dm" && input.state === "new") return step("greet")
    const cap = Math.min(MAX_QUESTIONS, input.questions.length)
    if (input.asked < cap) return step("ask", input.asked)
    if (!input.contactKnown && !input.contactAsked && input.asked < MAX_QUESTIONS && input.score.level !== "cold")
        return step("ask_contact")
    return step(input.score.level === "cold" ? "close" : "follow_up")
}

/** The text of a question turn: the short acknowledgement or answer first, then the owner's question verbatim. */
export const composeAsk = (parts: ComposeAsk): string =>
    [parts.reply.trim() || parts.thanks, parts.question.trim()].filter((part) => part !== "").join("\n\n")

/** The package Sales receives with a hot lead: need, answers, score and why, source, last message time. */
export const handoffNeed = (pack: HandoffPack): string =>
    [
        pack.need ?? "",
        pack.answers.length > 0
            ? `${pack.labels.answers}: ${pack.answers.map((answer) => `${answer.question} → ${answer.answer}`).join(" | ")}`
            : "",
        `${pack.labels.score}: ${pack.score.level} (${pack.score.reasons.join(", ")})`,
        `${pack.labels.source}: ${pack.sourceLine}`,
        pack.lastUserAt === null ? "" : `${pack.labels.lastMessage}: ${pack.lastUserAt}`,
    ]
        .filter((line) => line !== "")
        .join("\n")
        .slice(0, 900)
