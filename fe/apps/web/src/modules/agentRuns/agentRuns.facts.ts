import type { AgentRunStepWire } from "./agentRuns.types"

/** One raw fact of a step as the back end tells it. */
interface Fact {
    readonly key: string
    readonly value: string
}

/** The keys of what a step made that read as one plain line. */
const RESULT_KEYS = ["reply", "replyText", "summary", "arrival", "amount", "answer"] as const

const IMAGE_FILE = /^(https?:\/\/|\/|blob:).*\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i
const IMAGE_DATA = /^data:image\//i

/** A value that is a translation key or a code path ("billing.bankFeedTag"), not words a person wrote. */
const CODE_PATH = /^[a-z]\w*(\.\w+)+$/

const find = (facts: ReadonlyArray<Fact>, keys: ReadonlyArray<string>): Fact | undefined =>
    facts.find((fact) => keys.includes(fact.key) && fact.value !== "" && !CODE_PATH.test(fact.value))

/** The pictures the step sent: every value that is the address of an image. */
export const sentOf = (step: AgentRunStepWire): ReadonlyArray<string> =>
    step.output.filter((fact) => (IMAGE_FILE.test(fact.value) || IMAGE_DATA.test(fact.value))).map((fact) => fact.value)

/** The facts the back end adds to a step the AI core took over: the kind of trouble, and its code. They are not what the step made. */
export const RECOVERED_KEY = "recovered"
/** The key of the recovery code the AI core adds to a step it took over. */
export const RECOVERED_CODE_KEY = "recoveredCode"

/** The kind of trouble the AI core took the step over from ("threw", "refused", "failed", "confused"), or null on a step that ran as written. */
export const recoveredKindOf = (step: AgentRunStepWire): string | null =>
    step.output.find((fact) => fact.key === RECOVERED_KEY)?.value ?? null

/** What the step made, without the marks of the take-over. */
export const madeFactsOf = (step: AgentRunStepWire): AgentRunStepWire["output"] =>
    step.output.filter((fact) => fact.key !== RECOVERED_KEY && fact.key !== RECOVERED_CODE_KEY)

/** What the step came to as one plain line, or empty when the data says nothing a person reads. */
export const resultOf = (step: AgentRunStepWire): string => find(step.output, RESULT_KEYS)?.value ?? ""
