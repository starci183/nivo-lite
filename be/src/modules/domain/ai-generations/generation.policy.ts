import type { AiMessage, AiUsage } from "@modules/integrations/ai"
import type {
    GenMessage,
    GenerateParams,
    GenerationInput,
    GenerationProgress,
    GenerationWork,
    PollVerdict,
    QueuedGeneration,
    ResponseFormat,
    RunUsage,
} from "./ai-generations.contracts"
import type { AiGenerationEntity } from "./persistence/entities"

/** The part of a generation row a caller polls. */
export type GenerationProgressFields = Pick<AiGenerationEntity, "status" | "output" | "usage" | "timings">

/** The part of a generation row the runner works on. */
export type GenerationRunFields = Pick<
    AiGenerationEntity,
    "id" | "workspaceId" | "purpose" | "module" | "usageKind" | "status" | "input"
>

/** The deadline of a caller that names none, ms. */
export const DEFAULT_TIMEOUT_MS = 45_000
const MIN_TIMEOUT_MS = 5000
const MAX_TIMEOUT_MS = 120_000
const TURN_MARGIN_MS = 3000
const PURPOSE_MAX = 60

/** Accepts persisted JSON objects while rejecting arrays and null. */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

/** How long a caller waits: its own deadline kept between 5 and 120 seconds. */
export const clampTimeout = (timeoutMs: number | undefined): number =>
    Math.max(MIN_TIMEOUT_MS, Math.min(timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS))

/** How long the model call may take: the caller's deadline less a margin to write the answer. */
export const turnTimeoutOf = (timeoutMs: number): number => Math.max(MIN_TIMEOUT_MS, timeoutMs - TURN_MARGIN_MS)

/** The purpose as the row keeps it. */
export const purposeOf = (purpose: string): string => purpose.slice(0, PURPOSE_MAX)

/** The input JSON a queued generation stores. */
export const inputJsonOf = (params: GenerateParams, timeoutMs: number): Record<string, unknown> => ({
    messages: params.messages,
    response_format: params.responseFormat,
    timeout_ms: timeoutMs,
})

const isMessage = (value: unknown): value is GenMessage =>
    isPlainObject(value) &&
    (value.role === "system" || value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string"

const formatOf = (value: unknown): ResponseFormat => (value === "json" ? "json" : "text")

/** A text member of a stored object, or null. */
const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** The stored work of a generation, or null when none was stored or it is not that shape. */
const workOf = (value: unknown): GenerationWork | null => {
    if (!isPlainObject(value) || typeof value.kind !== "string" || value.kind === "") return null
    return {
        kind: value.kind,
        ref: textOf(value.ref),
        stepKey: textOf(value.step_key),
        agentId: textOf(value.agent_id),
    }
}

/** Reads the stored input back; a member that is missing or malformed takes its default. */
export const inputOf = (value: unknown): GenerationInput => {
    const input = isPlainObject(value) ? value : {}
    const runId = textOf(input.run_id)
    const work = workOf(input.work)
    return {
        messages: Array.isArray(input.messages) ? input.messages.filter(isMessage) : [],
        responseFormat: formatOf(input.response_format),
        timeoutMs: isNumber(input.timeout_ms) ? input.timeout_ms : DEFAULT_TIMEOUT_MS,
        ...(runId === null ? {} : { runId }),
        ...(work === null ? {} : { work }),
    }
}

/**
 * The run and work of the caller, as the stored input keeps them: a queued generation runs in a job, outside the caller's scopes,
 * so they travel with the row and the runner books the call to them (U1: model and credits per node, document, lesson).
 */
export const meteringJsonOf = (
    runId: string | null,
    work: {
        readonly kind: string
        readonly ref?: string | null | undefined
        readonly stepKey?: string | null | undefined
        readonly agentId?: string | null | undefined
    } | null,
): Record<string, unknown> => ({
    ...(runId === null ? {} : { run_id: runId }),
    ...(work === null
        ? {}
        : {
              work: {
                  kind: work.kind,
                  ref: work.ref ?? null,
                  step_key: work.stepKey ?? null,
                  agent_id: work.agentId ?? null,
              },
          }),
})

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
export const progressOf = (row: GenerationProgressFields): GenerationProgress => ({
    status: row.status,
    text: isPlainObject(row.output) && typeof row.output.text === "string" ? row.output.text : null,
    usage: usageOf(row.usage),
    timings: timingsOf(row.timings),
})

/** A generation row as the runner works on it. */
export const queuedOf = (row: GenerationRunFields): QueuedGeneration => ({
    id: row.id,
    workspaceId: row.workspaceId,
    purpose: row.purpose,
    module: row.module,
    usageKind: row.usageKind,
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

/** The last line of a prompt: the form of the answer, said the same way for every generation. */
const OUTPUT_RULE: Readonly<Record<ResponseFormat, string>> = {
    json: "Answer with ONLY the JSON object described above. No prose, no code fences.",
    text: "Answer with ONLY the requested text. No preface, no explanation.",
}

/** The prompt of a generation as the model reads it: the messages the app wrote, in order, then the form of the answer. */
export const promptOf = (input: GenerationInput): ReadonlyArray<AiMessage> => [
    ...input.messages.map((message) => ({ role: message.role, content: message.content })),
    { role: "system", content: OUTPUT_RULE[input.responseFormat] },
]

/** What the endpoint reported about a call, as the row and the meter keep it; a count it did not report is zero. */
export const runUsageOf = (usage: AiUsage, model: string): RunUsage => ({
    prompt_tokens: usage.promptTokens ?? 0,
    completion_tokens: usage.completionTokens ?? 0,
    cached_tokens: usage.cachedTokens ?? 0,
    cost: usage.costUsd ?? 0,
    model,
})
