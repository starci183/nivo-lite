import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectAi } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { InjectClock } from "@modules/platform/clock"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isGenerateWithAgentPayload } from "@modules/queues/agents"
import { AiGenerationCompletedEvent } from "@modules/events/api"
import type { AiGenerationCompletedPayload } from "@modules/events/api"
import type { GenerationRunStatus, QueuedGeneration, TurnAttempt } from "./ai-generations.contracts"
import { InjectUsage } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { UsageGate } from "./ai-generations.port"
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

@Injectable()
/**
 * Runs one queued generation: the prompt the app wrote goes once to the AI endpoint (`AiService.chat`, a plain model answer: no
 * tools, no history, nothing carried between requests) and the text lands on the `ai_generations` row the caller is looking at. It never
 * retries: the caller waits a bounded time and gives up on its own, so any failure is written on the row as the answer. A row the
 * caller already cancelled is left alone, and only text that was delivered is metered. The end of a generation is published as
 * `ai_generation_completed` in the transaction that writes it, so the capability that asked (content, video) applies the result
 * from the bus, retried until it holds, and a crash between the two loses nothing.
 */
export class GenerationRunnerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectUsage() private readonly usage: UsageGate,
        @InjectAi() private readonly ai: AiService,
        @InjectEventBus() private readonly bus: EventBus,
    ) {}

    /** Runs the generation the job names; the run publishes its end to the bus itself. */
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
     * One call of the model within the caller's deadline. The endpoint never throws: it answers nothing when the call failed, the
     * deadline passed or the text is empty, so a missing answer at or after the deadline is the timeout and any other is a failure.
     */
    private async attempt(generation: QueuedGeneration, startedAt: number): Promise<TurnAttempt> {
        if (!this.ai.available())
            return { text: null, usage: null, timings: {}, reason: NOT_CONFIGURED, timedOut: false }
        const timeoutMs = turnTimeoutOf(generation.input.timeoutMs)
        const answer = await this.ai.chat({
            messages: promptOf(generation.input),
            json: generation.input.responseFormat === "json",
            schema: null,
            timeoutMs,
            context: null,
            affinity: generation.workspaceId,
        })
        const modelMs = this.clock.now().getTime() - startedAt
        if (answer === null) {
            const timedOut = modelMs >= timeoutMs
            this.logger.warn(AiGenerationsLogEvent.GenerationUnanswered, { purpose: generation.purpose, timedOut })
            return { text: null, usage: null, timings: { model_ms: modelMs }, reason: NO_ANSWER, timedOut }
        }
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
            if (written !== undefined) await this.announce(tx, generation, "done")
            return written
        })
        if (row === undefined) return "dropped"
        await this.usage.record({
            workspaceId: generation.workspaceId,
            kind: row.usage_kind,
            module: row.module,
            usage: attempt.usage,
            completionChars: text.length,
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
            await this.announce(tx, generation, attempt.timedOut ? "cancelled" : "error")
        })
        return "error"
    }

    /** Publishes the end of the generation in the transaction that wrote it; consumers read the row, so the status is a hint. */
    private async announce(
        tx: EntityManager,
        generation: QueuedGeneration,
        status: AiGenerationCompletedPayload["status"],
    ): Promise<void> {
        const event = AiGenerationCompletedEvent.create({
            generationId: generation.id,
            workspaceId: generation.workspaceId,
            purpose: generation.purpose,
            status,
        })
        await this.bus.publish(event, tx, event.eventId)
    }

    private timingsOf(attempt: TurnAttempt, startedAt: number): Readonly<Record<string, number>> {
        return { ...attempt.timings, total_ms: this.clock.now().getTime() - startedAt }
    }
}
