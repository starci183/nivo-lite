import type { RunUsage } from "@modules/integrations/openclaw"
import type {
    GenMessage,
    GenerateParams,
    GenerationInput,
    GenerationProgress,
    PollVerdict,
    QueuedGeneration,
    ResponseFormat,
} from "./ai-generations.contracts"
import type { GenerationProgressRow, GenerationRow } from "./persistence/ai-generations.rows"

/** The deadline of a caller that names none, ms. */
export const DEFAULT_TIMEOUT_MS = 45_000
const MIN_TIMEOUT_MS = 5000
const MAX_TIMEOUT_MS = 120_000
const TURN_MARGIN_MS = 3000
const PURPOSE_MAX = 60
const FAILURE_MAX = 200

/** Accepts persisted JSON objects while rejecting arrays and null. */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

/** How long a caller waits: its own deadline kept between 5 and 120 seconds. */
export const clampTimeout = (timeoutMs: number | undefined): number =>
    Math.max(MIN_TIMEOUT_MS, Math.min(timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS))

/** How long the turn on the gateway may take: the caller's deadline less a margin to write the answer. */
export const turnTimeoutOf = (timeoutMs: number): number => Math.max(MIN_TIMEOUT_MS, timeoutMs - TURN_MARGIN_MS)

/** The purpose as the row keeps it. */
export const purposeOf = (purpose: string): string => purpose.slice(0, PURPOSE_MAX)

/** The failure text as the row keeps it. */
export const failureTextOf = (cause: unknown): string =>
    (cause instanceof Error ? cause.message : String(cause)).slice(0, FAILURE_MAX)

/** The input JSON a queued generation stores. */
export const inputJsonOf = (params: GenerateParams, timeoutMs: number): string =>
    JSON.stringify({ messages: params.messages, response_format: params.responseFormat, timeout_ms: timeoutMs })

const isMessage = (value: unknown): value is GenMessage =>
    isPlainObject(value) &&
    (value.role === "system" || value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string"

const formatOf = (value: unknown): ResponseFormat => (value === "json" ? "json" : "text")

/** Reads the stored input back; a member that is missing or malformed takes its default. */
export const inputOf = (value: unknown): GenerationInput => {
    const input = isPlainObject(value) ? value : {}
    return {
        messages: Array.isArray(input.messages) ? input.messages.filter(isMessage) : [],
        responseFormat: formatOf(input.response_format),
        timeoutMs: isNumber(input.timeout_ms) ? input.timeout_ms : DEFAULT_TIMEOUT_MS,
    }
}

/** Reads the usage a run reported; null when it is not the usage shape. */
export const usageOf = (value: unknown): RunUsage | null => {
    if (!isPlainObject(value)) return null
    const { prompt_tokens, completion_tokens, cached_tokens, cost, model } = value
    if (!isNumber(prompt_tokens) || !isNumber(completion_tokens) || !isNumber(cached_tokens) || !isNumber(cost)) {
        return null
    }
    return {
        prompt_tokens,
        completion_tokens,
        cached_tokens,
        cost,
        model: typeof model === "string" ? model : null,
    }
}

/** Reads the marks a run reported: only the numeric ones. */
export const timingsOf = (value: unknown): Readonly<Record<string, number>> =>
    isPlainObject(value)
        ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => isNumber(entry[1])))
        : {}

/** The row a caller polls, as the progress it shows. */
export const progressOf = (row: GenerationProgressRow): GenerationProgress => ({
    status: row.status,
    text: isPlainObject(row.output) && typeof row.output.text === "string" ? row.output.text : null,
    usage: usageOf(row.usage),
    timings: timingsOf(row.timings),
})

/** A generation row as the runner works on it. */
export const queuedOf = (row: GenerationRow): QueuedGeneration => ({
    id: row.id,
    workspaceId: row.workspace_id,
    purpose: row.purpose,
    module: row.module,
    usageKind: row.usage_kind,
    status: row.status,
    input: inputOf(row.input),
})

/** What a poll of the row means: done with text, failed, or still waiting (null). */
export const verdictOf = (progress: GenerationProgress): PollVerdict | null => {
    if (progress.status === "done" && progress.text !== null) return { kind: "done", text: progress.text, progress }
    if (progress.status === "error" || progress.status === "cancelled") return { kind: "failed" }
    return null
}

/** True while the row still waits for its text, so the runner may work on it. */
export const isWaiting = (status: string): boolean => status === "queued" || status === "running"

/** The text sent into the one-shot session: the app's system prompt first, then the dialogue, then the output format. */
export const composeTurn = (input: GenerationInput): string => {
    const system = input.messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n")
    const dialogue = input.messages.filter((message) => message.role !== "system")
    const last = dialogue.at(-1)
    const earlier = dialogue
        .slice(0, -1)
        .map((message) => `${message.role === "assistant" ? "NIVO" : "User"}: ${message.content}`)
        .join("\n")
    const output =
        input.responseFormat === "json"
            ? "[OUTPUT] Answer with ONLY the JSON object described above. No prose, no code fences."
            : "[OUTPUT] Answer with ONLY the requested text. No preface, no explanation."
    return [
        "[REQUEST: follow these instructions exactly]",
        system === "" ? "(no extra instructions)" : system,
        "",
        ...(earlier === "" ? [] : ["[CONVERSATION SO FAR]", earlier, ""]),
        "[INPUT]",
        last === undefined ? "" : last.content,
        "",
        output,
    ].join("\n")
}

/** Whether a failure is the deadline of the request passing (an aborted signal or a timeout error). */
export const isTimeoutCause = (cause: unknown): boolean =>
    cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")

/** Waits for the work, or fails the moment the signal aborts, so one deadline covers every step of a call. */
export const untilAborted = <T>(work: Promise<T>, signal: AbortSignal): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const onAbort = (): void => reject(signal.reason)
        if (signal.aborted) {
            onAbort()
            return
        }
        signal.addEventListener("abort", onAbort, { once: true })
        work.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort))
    })
