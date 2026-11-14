import { isBusinessFailure, isNodeConfused, type NodeConfusion, type StepFailure } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { isDomainError } from "@modules/platform/errors"
import { classifyFailure, type FailureClass as QueueFailureClass } from "@modules/platform/queue/queue-failure.policy"

/** How a step failed to complete: the node threw, an executor or the host refused, a business failure had no route, or its AI was confused. */
export type TroubleKind = "threw" | "refused" | "failed" | "confused"

/**
 * A step that could not complete, as the engine hands it to the AI core: what kind of trouble, its stable code, the raw words of it
 * (an error's name and message, a refusal, the AI's own reason) and the data that came with it. True facts only, nothing interpreted.
 */
export interface StepTrouble {
    /** How the step failed to complete. */
    readonly kind: TroubleKind
    /** The stable code the run is failed with when nothing recovers it. */
    readonly code: string
    /** The raw words: the error's name and message, the refusal's reason, the AI's reason. */
    readonly text: string
    /** The data that came with it (a failure's fields, an error's params, the AI's question). */
    readonly data: Readonly<Record<string, unknown>>
    /** The class `classifyFailure` gave the thrown cause (R81-4: the one classifier), absent for a typed end that threw nothing. */
    readonly thrownClass?: QueueFailureClass | undefined
}

/** The code of a step whose node threw something that names no code of its own. */
export const HANDLER_THREW = "handler_threw"

/** The code of a step whose node's AI said it cannot decide. */
export const AI_CONFUSED = "ai_confused"

/** The codes of a step the AI core itself could not decide: it was unreachable, or its answer broke the step's contract. */
export const AI_CORE_FAILED = "ai_core_failed"
export const AI_CORE_OUTPUT_INVALID = "ai_core_output_invalid"

const codeOf = (cause: unknown): string => {
    if (isDomainError(cause)) return cause.code
    const code: unknown = typeof cause === "object" && cause !== null ? Reflect.get(cause, "code") : undefined
    return typeof code === "string" && /^[A-Za-z0-9_.:-]{1,80}$/.test(code) ? code : HANDLER_THREW
}

/** The trouble of a node that threw: an executor's or the host's refusal under its own code, anything else as `handler_threw`. */
export const troubleOfThrow = (cause: unknown): StepTrouble => {
    const code = codeOf(cause)
    const text = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)
    return {
        kind: code === HANDLER_THREW ? "threw" : "refused",
        code,
        text,
        data: isDomainError(cause) ? { ...cause.params } : {},
        thrownClass: classifyFailure(cause),
    }
}

/**
 * The codes a step fails with when the AI itself failed: every try of a model call failed (the deadline, a cut or empty answer, the
 * provider), or its answers were never the JSON asked for. The prompt library made all its tries before it threw one of them.
 */
const AI_FAILURE_CODES: ReadonlySet<string> = new Set([
    "AI_TASKS_UNAVAILABLE",
    "AI_TASKS_JSON_NOT_RETURNED",
    // The node host's typed failure of an answer that does not fit the node's schema (never a raw parse error: P-FIX2).
    "GRAPH_NODES_MODEL_ANSWER_INVALID",
])

/**
 * True when the trouble is the AI's own failure. The AI core is then not asked: it is the same AI, which just failed all its
 * tries, so the engine reports in its own words with the facts (the tries made and what each failed as).
 */
export const isAiFailure = (trouble: StepTrouble): boolean => AI_FAILURE_CODES.has(trouble.code)

/**
 * The class of a step's failure (QUEUE-BUILD rule Q-2, R71/R73/R80), read from typed codes and declarations only, never from words:
 * `transient` (`classifyFailure` of platform/queue said so of the thrown cause: the network, a deadline, a busy or unavailable side), `outcome_unknown` (a call
 * that may or may not have acted), `ai_failed` (the AI's own tries are spent), `permanent` (everything else: refusals, `cannot`, rights,
 * schema, engine stop codes).
 */
export type FailureClass = "transient" | "outcome_unknown" | "ai_failed" | "permanent"

/** The saga kind of a step (`StepEffect.kind`, forward only, R81): it only reads, or it writes. */
export type StepSagaKind = "read" | "write"

/** What the retry reads of a tool beyond the trouble (R80/R81): its own `repeatable` declaration (null: a tool the registry does not hold). */
export interface FailureFacts {
    /** The tool's own `repeatable` declaration (null for a tool the registry does not hold: never repeatable). */
    readonly repeatable: (tool: string) => boolean | null
}

/** The tool an outcome-unknown trouble names (`params.effect` of `EffectOutcomeUnknownError`), or null. */
export const unknownToolOf = (trouble: StepTrouble): string | null => {
    const effect: unknown = trouble.data.effect
    return typeof effect === "string" && effect !== "" ? effect : null
}

/** The class of a trouble; `unknownCodes` are the engine's outcome-unknown codes. */
export const failureClassOf = (trouble: StepTrouble, unknownCodes: ReadonlySet<string>): FailureClass => {
    if (unknownCodes.has(trouble.code)) return "outcome_unknown"
    if (isAiFailure(trouble)) return "ai_failed"
    return trouble.thrownClass === "transient" ? "transient" : "permanent"
}

/** The pauses before the automatic retries of a step (1, 2, 4, 8 minutes): four retries over about fifteen minutes, never more. */
export const RETRY_PAUSES_MS: ReadonlyArray<number> = [60_000, 120_000, 240_000, 480_000]

/** What the engine does with a failed step: run it again after `pauseMs` (the `attempt`-th retry), or stop it for a person. */
export type RetryVerdict =
    | { readonly kind: "retry"; readonly attempt: number; readonly pauseMs: number }
    | { readonly kind: "stop"; readonly why: "not_retried" | "forward_only" | "exhausted" }

/**
 * Whether a failed step runs again by itself (rule Q-2 on the saga, R80): the saga kind first, then the class. A transient failure
 * left nothing outside, so any step runs again (a read, or a write whose call was typed "not sent"). An unknown
 * outcome runs again only when its tool declares `repeatable` (same key through the ledgers); otherwise the run stops for a person at
 * once: past a write the run only goes forward. Never more than `RETRY_PAUSES_MS.length` retries; `retried` counts those already made.
 */
export const retryVerdictOf = (
    saga: StepSagaKind,
    failure: FailureClass,
    trouble: StepTrouble,
    facts: FailureFacts,
    retried: number,
): RetryVerdict => {
    const tool = unknownToolOf(trouble)
    const repeatable = failure === "outcome_unknown" && tool !== null && facts.repeatable(tool) === true
    // A step that wrote outside (not a read) and does not know whether its write acted only goes forward: a person decides.
    if (failure === "outcome_unknown" && !repeatable) return { kind: "stop", why: saga === "read" ? "not_retried" : "forward_only" }
    if (failure !== "transient" && !repeatable) return { kind: "stop", why: "not_retried" }
    const pause = RETRY_PAUSES_MS[retried]
    return pause === undefined ? { kind: "stop", why: "exhausted" } : { kind: "retry", attempt: retried + 1, pauseMs: pause }
}

/** The trouble of a refusal the node step already named by its code. */
export const troubleOfRefusal = (code: string, text: string): StepTrouble => ({ kind: "refused", code, text, data: {} })

/** The trouble of a business failure no route of the graph takes. */
export const troubleOfFailure = (failure: StepFailure): StepTrouble => ({
    kind: "failed",
    code: failure.code,
    text: failure.message,
    data: { ...failure.fields },
})

/** The trouble of a node whose AI said it cannot decide, in its own words. */
export const troubleOfConfusion = (confusion: NodeConfusion): StepTrouble => ({
    kind: "confused",
    code: AI_CONFUSED,
    text: confusion.reason,
    data: confusion.question === null ? {} : { question: confusion.question },
})

/** What a caught node run ended in, when it is one of the typed ends of a node rather than a throw. */
export const typedEndOf = (
    cause: unknown,
): { readonly failure: StepFailure } | { readonly confusion: NodeConfusion } | null => {
    if (isBusinessFailure(cause)) return { failure: cause.failure }
    return isNodeConfused(cause) ? { confusion: cause.confusion } : null
}

/** The key the one report of a stuck step is posted under in the team chat: the founder's replies to it are the answers to the step. */
export const stuckKeyOf = (runId: string, stepKey: string): string => `run-stuck:${runId}:${stepKey}`

/**
 * The member of a trigger scope that carries what the founder answered, in the team chat, to the report of the step that runs again
 * (`[{ text, at }]`, oldest first). The engine fills it on the retry; the turn carries it to the step's agent and to the AI core.
 */
export const FOUNDER_ANSWERS_MEMBER = "founderAnswers"

/** The longest text one fact of a report holds. */
const FACT_MAX = 300

const scalarOf = (value: unknown): string | null => {
    if (typeof value === "string") return value === "" ? null : value.slice(0, FACT_MAX)
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    if (Array.isArray(value) && value.length > 0 && value.every((one) => typeof one === "string" || typeof one === "number")) {
        return value.join(", ").slice(0, FACT_MAX)
    }
    return null
}

/** What the engine knows for sure about a stuck step, as named facts in the order a person reads them. */
export type StuckFacts = ReadonlyArray<readonly [name: string, value: string]>

/** Where a step stands in its run, as the facts name it. */
export interface StuckWhere {
    /** The workflow the run executes (`<moduleKey>.<workflowKey>`), or its module. */
    readonly workflow: string
    /** The key of the node in the graph. */
    readonly nodeKey: string
    /** The installed node the step runs. */
    readonly nodeStep: string
    /** The run. */
    readonly runId: string
    /** The subject the trigger names (`bank-transaction:<id>`), or null. */
    readonly subject: string | null
}

/**
 * The true facts the engine attaches to every report: where the run stopped, why (the code and the raw words), the data that came with
 * the trouble, and the plain values the step was given (ids, amounts). Nothing here is worded by a model. These are raw values for the
 * AI core and the run's record; a thread's stop card words them (team-chat `wordedStopFactsOf`, names kept in `STUCK_FACT`, checked
 * by this policy's spec) and shows a raw value only as a technical fact.
 */
export const stuckFactsOf = (
    where: StuckWhere,
    trouble: StepTrouble,
    given: Readonly<Record<string, unknown>>,
): StuckFacts => {
    const named = new Map<string, string>([
        ["workflow", where.workflow],
        ["step", `${where.nodeKey} (${where.nodeStep})`],
        ["code", trouble.code],
        ["error", trouble.text.slice(0, FACT_MAX)],
    ])
    if (where.subject !== null) named.set("subject", where.subject)
    for (const [name, value] of [...Object.entries(trouble.data), ...Object.entries(given)]) {
        const word = scalarOf(value)
        if (word !== null && !named.has(name)) named.set(name, word)
    }
    named.set("run", where.runId)
    return [...named.entries()]
}

/** The facts as the lines under a report. */
export const factLinesOf = (facts: StuckFacts): string => facts.map(([name, value]) => `- ${name}: ${value}`).join("\n")

/** The most characters of one part of what the AI core reads. */
const PART_MAX = 6000

/** A value as bounded JSON for the AI core: cut, never dropped silently. */
export const boundedJson = (value: unknown): string => {
    const text = JSON.stringify(value ?? null) ?? "null"
    return text.length <= PART_MAX ? text : `${text.slice(0, PART_MAX)}…(cut)`
}

/** The longest report or customer line the AI core writes. */
const WORDS_MAX = 4000

/** One way on the AI core suggests to the founder, and who would carry it out: the workflow (the step runs again) or a person. */
export interface CoreSuggestion {
    readonly text: string
    readonly handledBy: "workflow" | "person"
}

/** The AI core's report to the founder: why the step stopped, the one question, and 2 or 3 ways on, plus what it chose to tell the customer. */
export interface CoreReport {
    readonly decision: "report"
    readonly reason: string
    readonly question: string | null
    readonly suggestions: ReadonlyArray<CoreSuggestion>
    readonly customerLine: string | null
}

/** The fewest and most ways on the AI core suggests. */
export const SUGGESTIONS_MIN = 2
export const SUGGESTIONS_MAX = 3

/** The longest one suggestion is. */
const SUGGESTION_MAX = 300

/** What the AI core answers for a step that acts on the world: it can only report. */
export const coreReportSchema: z.ZodType<CoreReport> = z.object({
    decision: z.literal("report"),
    reason: z.string().min(1).max(WORDS_MAX),
    question: z.string().max(WORDS_MAX).nullable(),
    suggestions: z
        .array(z.object({ text: z.string().min(1).max(SUGGESTION_MAX), handledBy: z.enum(["workflow", "person"]) }))
        .min(SUGGESTIONS_MIN)
        .max(SUGGESTIONS_MAX),
    customerLine: z.string().max(WORDS_MAX).nullable(),
})

/** What the AI core answers when it may produce the step's output: the output, or its report. */
export const coreDecisionSchema: z.ZodType<{ readonly decision: "output"; readonly output: unknown } | CoreReport> =
    z.union([z.object({ decision: z.literal("output"), output: z.unknown() }), coreReportSchema])

const LANGUAGE = { vi: "Vietnamese", en: "English" } as const

/**
 * The instructions of the AI core for a step that could not complete. It decides, once: produce the step's output when the inputs and
 * the facts truly give it, else report to the founder. The hard limits are stated as limits, not as cases: it never invents a fact,
 * and a step that acts on the world (it runs effects) is never answered for, since its effect is the truth and only its executor,
 * under its own guard, may perform it.
 */
export const coreInstructionsOf = (locale: "vi" | "en", mayProduce: boolean): string =>
    [
        "You are the AI core of a shop's workflow engine. One step of a workflow could not complete. You are given the step's contract",
        "(what it does and the JSON schema of the output the next step needs), what it was given, the customer's memory and conversation",
        "when there is one, and the true facts of what went wrong. Decide ONCE, and answer ONLY with JSON.",
        mayProduce
            ? 'Option A, {"decision":"output","output":<the step\'s output>}: only when what you are given truly determines the output and it fits the output schema exactly (for example the data is all there but in another shape than the step expected). Never invent a payment, a transaction, an order, an amount, a name or any fact that is not in what you are given.'
            : "This step acts on the world (it sends, records or marks something), so you can NOT produce its output: only its own executor may, under its own guard. A refusal of that guard is a fact for you to report, never to work around.",
        `${mayProduce ? "Option B" : "Your answer"}, {"decision":"report","reason":"...","question":"..." or null,"suggestions":[{"text":"...","handledBy":"workflow"|"person"}, ...2 or 3],"customerLine":"..." or null}: when you cannot. These are for the shop's founder in the team chat, in ${LANGUAGE[locale]}, plain words, no code terms. "reason": what happened and what it means for the order or the customer. "question": the one thing you need them to answer, or null. "suggestions": 2 or 3 short ways on the founder can pick by one tap, each a sentence they could send as their answer; "handledBy" is "workflow" when the step can simply run again once they say it, "person" when somebody must do it by hand. The workflow then waits for their answer and this step runs again.`,
        "When the trigger carries `founderAnswers`, the founder already answered an earlier report of this step: their answer is a fact and a decision to follow, and you do not ask the same thing again.",
        `"customerLine" is what the shop says to the customer now, in ${LANGUAGE[locale]}, or null. Null when no conversation is given or the customer needs to hear nothing. Otherwise it may only be a holding line (the shop is checking and will come back): never confirm, promise or deny a payment, a refund or a delivery, and never mention an internal error. If the customer's last message has no answer yet, answer it with such a line.`,
    ].join("\n")
