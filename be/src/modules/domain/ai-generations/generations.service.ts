import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectAgentsQueue } from "@modules/queues/agents"
import type { AgentsQueue } from "@modules/queues/agents"
import type {
    GenerateParams,
    GenerationContext,
    GenerationResult,
    GenerationFailure,
    GenerationFailureReason,
    GenerationOutcome,
    GenerationRequested,
    GenerationEnqueued,
    GenerationStatus,
    OptionalGenerationFailure,
    OptionalGenerationState,
    OptionalGenerationProgress,
    PollVerdict,
    PreparedGenerationId,
} from "./ai-generations.contracts"
import { InjectAiGenerationsOptions, InjectUsage } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { AiGenerationsOptions } from "./ai-generations.options"
import type { UsageGate } from "./ai-generations.port"
import { EngineStatusService, PauseClient } from "@modules/domain/agents"
import { AiGenerationsError, AiGenerationsErrorCode } from "./errors/ai-generations.error"
import { isRequestableKind } from "./request-kind.policy"
import {
    clampTimeout,
    inputJsonOf,
    inputOf,
    isPlainObject,
    progressOf,
    purposeOf,
    verdictOf,
} from "./generation.policy"
import { AiGenerationEntity } from "./persistence/entities"

/** The generations that still wait for a text, so a cancel or a finish may change them. */
const OPEN_STATUSES = ["queued", "running"] as const

const failure = (reason: GenerationFailureReason, message: string): GenerationFailure => ({
    ok: false,
    reason,
    message,
})

/** A stored JSON value as an object; anything else is empty. */
const record = (value: unknown): Record<string, unknown> => (isPlainObject(value) ? value : {})

@Injectable()
/**
 * OpenClaw is the only text-generating AI in NIVO. This is the one door for every text the app writes outside customer chat (setup
 * chat, owner chat, Office replies, lead classification, automation drafts): it writes an `ai_generations` row and its job in one
 * transaction, then looks at the row until the job (run by `GenerationRunnerService`) fills it in or the caller's deadline passes. It
 * never calls a model itself. A failure says why (`reason`) with a sentence in the request language; background callers decide for
 * themselves (retry, skip, hand to a person).
 */
export class GenerationsService {
    constructor(
        private readonly engine: EngineStatusService,
        @InjectLogger() private readonly logger: Logger,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectUsage() private readonly usage: UsageGate,
        @InjectAgentsQueue() private readonly queue: AgentsQueue,
        private readonly pause: PauseClient,
        @InjectAiGenerationsOptions() private readonly options: AiGenerationsOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Why a text cannot be written now: the quota of the workspace is used up, or the engine is off; null when it can. */
    async refusalOf(params: GenerateParams): Promise<OptionalGenerationFailure> {
        const locale = params.locale ?? "vi"
        const blocked = await this.usage.blockedBy(params.workspaceId, params.kind, locale)
        if (blocked !== null) return failure("quota", blocked.message)
        const availability = this.engine.availability()
        if (availability === "ready") return null
        return failure(availability === "offline" ? "engine_offline" : "not_configured", this.busyText(params))
    }

    /** The sentence shown when a text could not be written, in the language of the request. */
    busyText(params: GenerateParams): string {
        return this.catalog.get("generation.busy", {}, params.locale ?? "vi")
    }

    /** Writes one text and answers with it, or with the reason there is none. */
    async generate(params: GenerateParams): Promise<GenerationOutcome> {
        const refusal = await this.refusalOf(params)
        if (refusal !== null) return refusal
        const busy = this.busyText(params)
        return this.run(params, busy).catch((cause: unknown) => {
            this.logger.error(AiGenerationsLogEvent.GenerationFailed, cause, { purpose: params.purpose })
            return failure("error", busy)
        })
    }

    /** A generation a signed-in member asks for from the app: the caller must belong to the workspace the text is written for. */
    async generateFor(userId: string, params: GenerateParams): Promise<GenerationOutcome> {
        await this.members.require(userId, params.workspaceId)
        this.requireRequestable(params)
        return this.generate(params)
    }

    /** Enqueues an authorized application's request and immediately returns its polling id. */
    async request(
        params: GenerateParams,
        context: GenerationContext = {},
        tx?: EntityManager,
    ): Promise<GenerationEnqueued> {
        const locale = params.locale ?? "vi"
        const blocked = await this.usage.blockedBy(params.workspaceId, params.kind, locale)
        const availability = this.engine.availability()
        if (blocked !== null || availability !== "ready") {
            throw new AiGenerationsError({
                code: blocked !== null ? AiGenerationsErrorCode.QuotaBlocked : AiGenerationsErrorCode.EngineUnavailable,
            })
        }
        const enqueue = async (manager: EntityManager): Promise<GenerationEnqueued> => {
            const id = await this.store(
                params,
                { ...inputJsonOf(params, clampTimeout(params.timeoutMs)), context },
                manager,
            )
            await this.queue.enqueueGenerate({ generationId: id, workspaceId: params.workspaceId }, manager)
            return { id, status: "queued" }
        }
        return tx === undefined ? this.entityManager.transaction(enqueue) : enqueue(tx)
    }

    /** Reads a workspace's request; an optional lock serializes a job's idempotent domain completion. */
    async state(
        workspaceId: string,
        id: string,
        tx?: EntityManager,
        lock: boolean = false,
    ): Promise<OptionalGenerationState> {
        const row = await (tx ?? this.entityManager).findOne(AiGenerationEntity, {
            where: { id, workspaceId },
            ...(lock ? { lock: { mode: "pessimistic_write" } } : {}),
        })
        if (row === null) return null
        const progress = progressOf(row)
        return {
            id: row.id,
            workspaceId: row.workspaceId,
            purpose: row.purpose,
            status: row.status,
            text: progress.text,
            errorCode: row.error,
            input: record(row.input),
            output: record(row.output),
            timings: progress.timings,
            createdAt: row.createdAt.toISOString(),
            finishedAt: row.finishedAt === null ? null : row.finishedAt.toISOString(),
            messages: inputOf(row.input).messages,
        }
    }

    /** Finalizes trusted context inside the same transaction that enqueues all related generations. */
    async setContext(workspaceId: string, id: string, context: GenerationContext, tx: EntityManager): Promise<void> {
        await tx
            .createQueryBuilder(AiGenerationEntity, "g")
            .update()
            .set({ input: () => "jsonb_set(input, '{context}', CAST(:context AS jsonb), true)" })
            .where({ id, workspaceId })
            .setParameter("context", JSON.stringify(context))
            .execute()
    }

    /** Records the domain result in the transaction that writes its effects. */
    async recordResult(workspaceId: string, id: string, result: GenerationResult, tx: EntityManager): Promise<void> {
        await tx
            .createQueryBuilder(AiGenerationEntity, "g")
            .update()
            .set({
                output: () => "coalesce(output, '{}'::jsonb) || jsonb_build_object('result', CAST(:result AS jsonb))",
            })
            .where({ id, workspaceId, status: "done" })
            .setParameter("result", JSON.stringify(result))
            .execute()
    }

    /** Records a stable application error code after the engine or result validation fails. */
    async recordFailure(workspaceId: string, id: string, code: string, tx: EntityManager): Promise<void> {
        await tx
            .createQueryBuilder(AiGenerationEntity, "g")
            .update()
            .set({ status: "error", error: code, finishedAt: () => "coalesce(finished_at, now())" })
            .where({ id, workspaceId })
            .execute()
    }

    /** Queues a text a signed-in member asks for and answers its id at once (or why it was not queued); the text is read with `statusFor`. */
    async requestFor(userId: string, params: GenerateParams): Promise<GenerationRequested> {
        await this.members.require(userId, params.workspaceId)
        this.requireRequestable(params)
        const refusal = await this.refusalOf(params)
        if (refusal !== null) return refusal
        const generationId = await this.enqueue(params, clampTimeout(params.timeoutMs))
        return { ok: true, generationId }
    }

    /** Refuses a kind the named module does not own on the generic doors (never a NIVO-paid kind such as `guide`). */
    private requireRequestable(params: GenerateParams): void {
        if (!isRequestableKind(params.module, params.kind)) {
            throw new AiGenerationsError({ code: AiGenerationsErrorCode.KindNotAllowed })
        }
    }

    /** Where a queued text of the workspace stands; any member may look. */
    async statusFor(userId: string, workspaceId: string, generationId: string): Promise<GenerationStatus> {
        await this.members.require(userId, workspaceId)
        const progress = await this.poll(generationId, workspaceId)
        if (progress === null) throw new AiGenerationsError({ code: AiGenerationsErrorCode.GenerationNotFound })
        const verdict = verdictOf(progress)
        const status = verdict?.kind === "failed" ? "failed" : progress.status
        return {
            generationId,
            status: status === "done" || status === "failed" || status === "running" ? status : "queued",
            output: progress.text,
            usage: progress.usage,
            timings: progress.timings,
        }
    }

    /** For callers that just want the text: the output, or an `AiGenerationsError` carrying the sentence to show. */
    async text(params: GenerateParams): Promise<string> {
        const outcome = await this.generate(params)
        if (outcome.ok) return outcome.output
        throw new AiGenerationsError({
            code: AiGenerationsErrorCode.GenerationFailed,
            params: { reason: outcome.reason, message: outcome.message },
        })
    }

    /** Prepares a generation for a fenced job that will run it itself, without starting a second job or waiting for a slot. */
    async prepare(params: GenerateParams, tx: EntityManager): Promise<PreparedGenerationId> {
        const blocked = await this.usage.blockedBy(params.workspaceId, params.kind, params.locale ?? "vi")
        if (blocked !== null || this.engine.availability() !== "ready") return null
        return this.store(params, inputJsonOf(params, clampTimeout(params.timeoutMs)), tx)
    }

    /** Reads the progress of a generation in the workspace that requested it. */
    progress(workspaceId: string, id: string): Promise<OptionalGenerationProgress> {
        return this.poll(id, workspaceId)
    }

    private async run(params: GenerateParams, busy: string): Promise<GenerationOutcome> {
        const timeoutMs = clampTimeout(params.timeoutMs)
        const deadline = this.clock.now().getTime() + timeoutMs
        const id = await this.enqueue(params, timeoutMs)
        const verdict = await this.wait(id, params.workspaceId, deadline)
        if (verdict.kind === "done") {
            return {
                ok: true,
                output: verdict.text,
                generationId: id,
                timings: verdict.progress.timings,
                usage: verdict.progress.usage,
            }
        }
        if (verdict.kind === "failed") {
            this.logger.warn(AiGenerationsLogEvent.GenerationErrored, { purpose: params.purpose, generationId: id })
            return failure("error", busy)
        }
        // Too slow: free the row so the job cannot answer later, and drop whatever it would have produced.
        await this.entityManager.update(
            AiGenerationEntity,
            { id, workspaceId: params.workspaceId, status: In(OPEN_STATUSES) },
            { status: "cancelled", error: "timeout", finishedAt: this.clock.now() },
        )
        return failure("timeout", busy)
    }

    private enqueue(params: GenerateParams, timeoutMs: number): Promise<string> {
        return this.entityManager.transaction(async (tx) => {
            const id = await this.store(params, inputJsonOf(params, timeoutMs), tx)
            await this.queue.enqueueGenerate({ generationId: id, workspaceId: params.workspaceId }, tx)
            return id
        })
    }

    /** Writes a queued generation and answers its id. */
    private async store(
        params: GenerateParams,
        input: Record<string, unknown>,
        manager: EntityManager,
    ): Promise<string> {
        const inserted = await manager.insert(AiGenerationEntity, {
            workspaceId: params.workspaceId,
            purpose: purposeOf(params.purpose),
            module: params.module,
            usageKind: params.kind,
            input,
        })
        const id: unknown = inserted.identifiers[0]?.id
        if (typeof id !== "string") throw new AiGenerationsError({ code: AiGenerationsErrorCode.NotCreated })
        return id
    }

    /** Looks at the row every poll interval until it has text, failed, or the deadline passed (a vanished row counts as too slow). */
    private async wait(id: string, workspaceId: string, deadline: number): Promise<PollVerdict> {
        if (this.clock.now().getTime() >= deadline) return { kind: "timeout" }
        await this.pause.wait(this.options.pollMs)
        const progress = await this.poll(id, workspaceId)
        if (progress === null) return { kind: "timeout" }
        return verdictOf(progress) ?? this.wait(id, workspaceId, deadline)
    }

    private async poll(id: string, workspaceId: string): Promise<OptionalGenerationProgress> {
        const row = await this.entityManager.findOne(AiGenerationEntity, {
            where: { id, workspaceId },
            select: { status: true, output: true, usage: true, timings: true },
        })
        return row === null ? null : progressOf(row)
    }
}
