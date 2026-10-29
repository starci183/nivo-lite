import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GenerateParams, GenerationOutcome } from "./ai-generations.contracts"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import { AiGenerationsError, AiGenerationsErrorCode } from "./errors/ai-generations.error"
import { GenerationRunnerService } from "./generation-runner.service"
import { GenerationsService } from "./generations.service"
import { clampTimeout, inputJsonOf, progressOf, purposeOf, verdictOf } from "./generation.policy"
import { AiGenerationEntity } from "./persistence/entities"

@Injectable()
/**
 * A text written by a job that already runs in the background (the answer of the setup chat): the row is written and run right here
 * instead of being queued and waited for, so a job never waits on another job. The quota and the engine are checked first and a
 * failure says why, exactly like `GenerationsService.generate`.
 */
export class DirectGenerationService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly generations: GenerationsService,
        private readonly runner: GenerationRunnerService,
    ) {}

    /** Writes one text now and answers it, or the reason there is none. */
    async run(params: GenerateParams): Promise<GenerationOutcome> {
        const refusal = await this.generations.refusalOf(params)
        if (refusal !== null) return refusal
        return this.generate(params).catch((cause: unknown) => {
            this.logger.error(AiGenerationsLogEvent.GenerationFailed, cause, { purpose: params.purpose })
            return { ok: false, reason: "error", message: this.generations.busyText(params) }
        })
    }

    private async generate(params: GenerateParams): Promise<GenerationOutcome> {
        const inserted = await this.entityManager.insert(AiGenerationEntity, {
            workspaceId: params.workspaceId,
            purpose: purposeOf(params.purpose),
            module: params.module,
            usageKind: params.kind,
            input: inputJsonOf(params, clampTimeout(params.timeoutMs)),
        })
        const id: unknown = inserted.identifiers[0]?.id
        if (typeof id !== "string") throw new AiGenerationsError({ code: AiGenerationsErrorCode.NotCreated })
        await this.runner.run({ generationId: id, workspaceId: params.workspaceId })
        const stored = await this.entityManager.findOne(AiGenerationEntity, {
            where: { id, workspaceId: params.workspaceId },
            select: { status: true, output: true, usage: true, timings: true },
        })
        const progress = stored === null ? null : progressOf(stored)
        const verdict = progress === null ? null : verdictOf(progress)
        if (progress === null || verdict?.kind !== "done") {
            return { ok: false, reason: "error", message: this.generations.busyText(params) }
        }
        return {
            ok: true,
            output: verdict.text,
            generationId: id,
            timings: progress.timings,
            usage: progress.usage,
        }
    }
}
