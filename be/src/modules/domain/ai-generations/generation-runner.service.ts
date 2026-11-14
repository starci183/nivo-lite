import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { InjectAi, spendOf, type AiService } from "@modules/integrations/ai"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type { ClaimedJob } from "@modules/platform/jobs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { isGenerateWithAgentPayload } from "@modules/queues/agents"
import type { GenerationRunStatus, QueuedGeneration, TurnAttempt } from "./ai-generations.contracts"
import { InjectUsage } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { GenerationUsageRecord, UsageGate } from "./ai-generations.port"
import { isWaiting, promptOf, queuedOf, runUsageOf, turnTimeoutOf } from "./generation.policy"
import { AiGenerationEntity } from "./persistence/entities"

/** The generations that still wait for a text, so a cancel, a failure or a finish may change them. */
const OPEN_STATUSES = ["queued", "running"] as const

/** What a finished generation answers for the meter. */
interface Metering {
    /** The usage kind. */
    readonly usage_kind: string
    /** The usage module. */
    readonly module: string
}

/** The first row an UPDATE that returns the usage kind and module answered, or nothing when no row changed. */
const meteringOf = (raw: unknown): Metering | undefined => {
    const row: unknown = Array.isArray(raw) ? raw[0] : undefined
    if (typeof row !== "object" || row === null) return undefined
    const usage_kind: unknown = Reflect.get(row, "usage_kind")
    const module: unknown = Reflect.get(row, "module")
    return typeof usage_kind === "string" && typeof module === "string" ? { usage_kind, module } : undefined
}

/** Why a generation has no text, as the row keeps it. */
const NOT_CONFIGURED = "ai_not_configured"
const NO_ANSWER = "no_answer"
/** The credit pool of the workspace is empty: no call was made; the caller may ask again once credits return. */
const NO_CREDITS = "no_credits"
/** The language of the allowance's block message, which the runner never shows (it only asks whether the pool is empty). */
const BLOCK_LOCALE = "vi"
/** The model a failed try is booked with: the endpoint's chat profile was asked, its model was never told. */
const UNTOLD_MODEL = "work"

/** The characters of a queued prompt, to estimate the tokens of a try that got no answer. */
const promptCharsOf = (input: QueuedGeneration["input"]): number =>
    input.messages.reduce((total, message) => total + message.content.length, 0)

@Injectable()
/**
 * Runs one queued generation: the prompt the app wrote goes once to the AI endpoint (`AiService.chat`, a plain model answer: no
 * tools, no history, nothing carried between requests) and the text lands on the `ai_generations` row the caller is looking at. It never
 * retries: the caller waits a bounded time and gives up on its own, so any failure is written on the row as the answer. A row the
 * caller already cancelled is left alone, and only text that was delivered is metered.
 */
export class GenerationRunnerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectUsage() private readonly usage: UsageGate,
        @InjectAi() private readonly ai: AiService,
    ) {}

    /** Runs the generation the job names; */
    async runJob(job: ClaimedJob): Promise<void> {
        await this.run(job.payload)
    }

    /** Runs the generation the job names; the row's own workspace is the tenant, whatever else the payload says. */
    async run(payload: object): Promise<GenerationRunStatus> {
        if (!isGenerateWithAgentPayload(payload)) return "dropped"
        const row = await this.entityManager.findOne(AiGenerationEntity, {
            where: { id: payload.generationId, workspaceId: payload.workspaceId },
            select: {
                id: true,
                workspaceId: true,
                purpose: true,
                module: true,
                usageKind: true,
                status: true,
                input: true,
            },
        })
        if (row === null) return "dropped"
        const generation = queuedOf(row)
        if (!isWaiting(generation.status)) return "dropped"
        await this.entityManager.update(
            AiGenerationEntity,
            { id: generation.id, workspaceId: generation.workspaceId, status: "queued" },
            { status: "running" },
        )
        const startedAt = this.clock.now().getTime()
        const attempt = await this.attempt(generation, startedAt)
        return attempt.text === null
            ? this.fail(generation, attempt, startedAt)
            : this.finish(generation, attempt, attempt.text, startedAt)
    }

    /**
     * One call of the model within the caller's deadline, after the credit pool is checked (owner: the pool is the only limit; out of
     * credits the row says `no_credits` and no call is made). A try that got no text is a failure; one that still returned tokens (cut
     * at its cap, or empty) carries what it spent, which `fail` books. A missing answer at or after the deadline is the timeout.
     */
    private async attempt(generation: QueuedGeneration, startedAt: number): Promise<TurnAttempt> {
        if (!this.ai.available())
            return { text: null, usage: null, timings: {}, reason: NOT_CONFIGURED, timedOut: false }
        if ((await this.usage.blockedBy(generation.workspaceId, generation.usageKind, BLOCK_LOCALE)) !== null)
            return { text: null, usage: null, timings: {}, reason: NO_CREDITS, timedOut: false }
        const timeoutMs = turnTimeoutOf(generation.input.timeoutMs)
        const tried = await this.ai.attempt({
            messages: promptOf(generation.input),
            json: generation.input.responseFormat === "json",
            schema: null,
            timeoutMs,
            context: null,
            affinity: generation.workspaceId,
        })
        const modelMs = this.clock.now().getTime() - startedAt
        const spend = spendOf(tried)
        if (!tried.ok) {
            const timedOut = spend === null && modelMs >= timeoutMs
            this.logger.warn(AiGenerationsLogEvent.GenerationUnanswered, { purpose: generation.purpose, timedOut })
            return {
                text: null,
                usage: spend === null ? null : runUsageOf(spend.usage, spend.model),
                timings: { model_ms: modelMs },
                reason: NO_ANSWER,
                timedOut,
            }
        }
        const answer = tried.answer
        return {
            text: answer.text,
            usage: runUsageOf(answer.usage, answer.model),
            timings: { model_ms: modelMs },
            reason: "",
            timedOut: false,
        }
    }

    private async finish(
        generation: QueuedGeneration,
        attempt: TurnAttempt,
        text: string,
        startedAt: number,
    ): Promise<GenerationRunStatus> {
        const row = await this.entityManager.transaction(async (tx) => {
            const result = await tx
                .createQueryBuilder(AiGenerationEntity, "g")
                .update()
                .set({
                    status: "done",
                    output: { text },
                    usage: attempt.usage === null ? null : { ...attempt.usage },
                    timings: this.timingsOf(attempt, startedAt),
                    finishedAt: this.clock.now(),
                })
                .where({ id: generation.id, workspaceId: generation.workspaceId, status: In(OPEN_STATUSES) })
                .returning("usage_kind, module")
                .execute()
            const written = meteringOf(result.raw)
            return written
        })
        if (row === undefined) return "dropped"
        await this.usage.record({
            workspaceId: generation.workspaceId,
            kind: row.usage_kind,
            module: row.module,
            usage: attempt.usage,
            completionChars: text.length,
            ...this.meteringOf(generation),
        })
        return "done"
    }

    private async fail(
        generation: QueuedGeneration,
        attempt: TurnAttempt,
        startedAt: number,
    ): Promise<GenerationRunStatus> {
        // A deadline that passed is a cancelled request with the reason `timeout`, as it is when the caller gives up first.
        await this.entityManager.transaction(async (tx) => {
            if (attempt.timedOut) {
                await tx.update(
                    AiGenerationEntity,
                    { id: generation.id, workspaceId: generation.workspaceId, status: In(OPEN_STATUSES) },
                    { status: "cancelled", error: "timeout", finishedAt: this.clock.now() },
                )
            } else {
                await tx.update(
                    AiGenerationEntity,
                    { id: generation.id, workspaceId: generation.workspaceId, status: In(OPEN_STATUSES) },
                    {
                        status: "error",
                        error: attempt.reason,
                        timings: this.timingsOf(attempt, startedAt),
                        finishedAt: this.clock.now(),
                    },
                )
            }
        })
        // A try that gave no usable answer is never billed (concept.tokens-and-credits): one that returned tokens (cut at its cap, or
        // empty) is booked with what it spent, one the model was asked and did not answer is booked estimated from the prompt. Each
        // try exactly once.
        if (attempt.usage !== null) {
            await this.usage.record({
                workspaceId: generation.workspaceId,
                kind: generation.usageKind,
                module: generation.module,
                usage: attempt.usage,
                completionChars: 0,
                failure: "no_answer",
                reported: true,
                ...this.meteringOf(generation),
            })
        } else if (attempt.reason !== NOT_CONFIGURED && attempt.reason !== NO_CREDITS) {
            await this.usage.record({
                workspaceId: generation.workspaceId,
                kind: generation.usageKind,
                module: generation.module,
                usage: null,
                completionChars: 0,
                promptChars: promptCharsOf(generation.input),
                model: UNTOLD_MODEL,
                failure: attempt.timedOut ? "timeout" : "no_answer",
                ...this.meteringOf(generation),
            })
        }
        return "error"
    }

    /** The run and work the caller asked in, carried by the queued row, as the meter books them. */
    private meteringOf(generation: QueuedGeneration): Pick<GenerationUsageRecord, "runId" | "work"> {
        const { runId, work } = generation.input
        return { ...(runId == null ? {} : { runId }), ...(work == null ? {} : { work }) }
    }

    private timingsOf(attempt: TurnAttempt, startedAt: number): Readonly<Record<string, number>> {
        return { ...attempt.timings, total_ms: this.clock.now().getTime() - startedAt }
    }
}
