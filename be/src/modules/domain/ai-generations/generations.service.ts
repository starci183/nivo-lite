import { Injectable } from "@nestjs/common"
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
    GenerationFailure,
    GenerationFailureReason,
    GenerationOutcome,
    OptionalGenerationProgress,
    PollVerdict,
    PreparedGenerationId,
} from "./ai-generations.contracts"
import { InjectAiGenerationsOptions, InjectUsage } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { AiGenerationsOptions } from "./ai-generations.options"
import type { UsageGate } from "./ai-generations.port"
import { EngineStatusService } from "@modules/domain/agents"
import { AiGenerationsError, AiGenerationsErrorCode } from "./errors/ai-generations.error"
import { clampTimeout, inputJsonOf, progressOf, purposeOf, verdictOf } from "./generation.policy"
import type { GenerationProgressRow, InsertedGenerationRow } from "./persistence/ai-generations.rows"
import { CANCEL_GENERATION, FIND_GENERATION_PROGRESS, INSERT_GENERATION } from "./persistence/ai-generations.sql"
import { PauseClient } from "@modules/domain/agents"

const failure = (reason: GenerationFailureReason, message: string): GenerationFailure => ({
    ok: false,
    reason,
    message,
})

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

    /** Writes one text and answers with it, or with the reason there is none. */
    async generate(params: GenerateParams): Promise<GenerationOutcome> {
        const locale = params.locale ?? "vi"
        const busy = this.catalog.get("generation.busy", {}, locale)
        const blocked = await this.usage.blockedBy(params.workspaceId, params.kind, locale)
        if (blocked !== null) return failure("quota", blocked.message)
        const availability = this.engine.availability()
        if (availability !== "ready") {
            return failure(availability === "offline" ? "engine_offline" : "not_configured", busy)
        }
        return this.run(params, busy).catch((cause: unknown) => {
            this.logger.error(AiGenerationsLogEvent.GenerationFailed, cause, { purpose: params.purpose })
            return failure("error", busy)
        })
    }

    /** A generation a signed-in member asks for from the app: the caller must belong to the workspace the text is written for. */
    async generateFor(userId: string, params: GenerateParams): Promise<GenerationOutcome> {
        await this.members.require(userId, params.workspaceId)
        return this.generate(params)
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
        return this.insert(params, clampTimeout(params.timeoutMs), tx)
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
        await this.entityManager.query(CANCEL_GENERATION, [id, params.workspaceId, this.clock.now().toISOString()])
        return failure("timeout", busy)
    }

    private enqueue(params: GenerateParams, timeoutMs: number): Promise<string> {
        return this.entityManager.transaction(async (tx) => {
            const id = await this.insert(params, timeoutMs, tx)
            await this.queue.enqueueGenerate({ generationId: id, workspaceId: params.workspaceId }, tx)
            return id
        })
    }

    private async insert(params: GenerateParams, timeoutMs: number, tx: EntityManager): Promise<string> {
        const [row] = await tx.query<Array<InsertedGenerationRow>>(INSERT_GENERATION, [
            params.workspaceId,
            purposeOf(params.purpose),
            params.module,
            params.kind,
            inputJsonOf(params, timeoutMs),
        ])
        if (row === undefined) throw new AiGenerationsError({ code: AiGenerationsErrorCode.NotCreated })
        return row.id
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
        const [row] = await this.entityManager.query<Array<GenerationProgressRow>>(FIND_GENERATION_PROGRESS, [
            id,
            workspaceId,
        ])
        return row === undefined ? null : progressOf(row)
    }
}
