import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectN8nClient, N8nError, N8nErrorCode } from "@modules/integrations/n8n"
import type { N8nClient } from "@modules/integrations/n8n"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { N8nQueue, isN8nEmitPayload } from "@modules/queues/n8n"
import { N8nRunsError, N8nRunsErrorCode } from "./errors/n8n-runs.error"
import type {
    N8nCompletion,
    N8nRunContext,
    OptionalRunId,
    RunContextOrNone,
    RunVerification,
    StartN8nRun,
} from "./n8n-runs.contracts"
import { N8nRunsLogEvent } from "./n8n-runs.log-events"
import {
    COMPLETE_N8N_RUN,
    INSERT_N8N_RUN,
    SELECT_API_BASE,
    SELECT_N8N_RUN,
    SELECT_RUN_PIPELINE,
} from "./persistence/n8n-runs.sql"
import type { CreatedRunRow, N8nRunRow, RunPipelineRow } from "./persistence/n8n-runs.rows"
import {
    RUN_TOKEN_TTL_MS,
    boundedResult,
    finalStatusOf,
    isWorkflowKey,
    parseBearer,
    runIsOpen,
    summaryOf,
    tokenMatches,
} from "./policies/n8n-run.policy"

@Injectable()
/** The runs of the shared n8n workflows: starting one, delivering it to n8n, proving the token n8n calls back with and closing it. */
export class N8nRunsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        @InjectN8nClient() private readonly n8n: N8nClient,
        private readonly queue: N8nQueue,
    ) {}

    /**
     * Starts one run of a workflow: the run row (with the hash of its token) and the delivery job are written in one transaction.
     * Answers the run id, or null when the same occurrence already started one.
     */
    async startRun(input: StartN8nRun): Promise<OptionalRunId> {
        if (!isWorkflowKey(input.templateKey)) {
            throw new N8nRunsError({ code: N8nRunsErrorCode.TemplateKeyInvalid, params: { key: input.templateKey } })
        }
        const [base] = await this.entityManager.query<Array<{ value: string }>>(SELECT_API_BASE)
        if (base === undefined) throw new N8nRunsError({ code: N8nRunsErrorCode.ApiBaseMissing })
        const expiresAt = new Date(this.clock.now().getTime() + RUN_TOKEN_TTL_MS)
        return this.entityManager.transaction(async (tx) => {
            const [run] = await tx.query<Array<CreatedRunRow>>(INSERT_N8N_RUN, [
                input.workspaceId,
                input.templateKey,
                input.dedupe,
                expiresAt,
            ])
            if (run === undefined) return null
            await this.queue.enqueueEmit(
                {
                    workspaceId: input.workspaceId,
                    runId: run.id,
                    event: `pipeline.${input.templateKey}`,
                    urls: [],
                    paths: [input.webhookPath],
                    data: {
                        run_id: run.id,
                        run_token: run.token,
                        api_base: base.value,
                        template_key: input.templateKey,
                        config: input.config,
                        data: input.data,
                    },
                },
                tx,
            )
            return run.id
        })
    }

    /**
     * The effect of one delivery job: posts the run to n8n. A target that failed for a reason worth retrying is rethrown, so the
     * queue retries the job; a refusal that retrying cannot change closes the run as failed.
     */
    async deliver(job: object): Promise<void> {
        if (!isN8nEmitPayload(job)) return
        const payload = job
        try {
            await this.n8n.deliver({
                deliveryId: payload.runId,
                workspaceId: payload.workspaceId,
                event: payload.event,
                urls: payload.urls,
                paths: payload.paths,
                data: payload.data,
                occurredAtMs: this.clock.now().getTime(),
            })
        } catch (cause) {
            if (!(cause instanceof N8nError) || cause.code === N8nErrorCode.DeliveryFailed) throw cause
            this.logger.warn(N8nRunsLogEvent.DeliveryRefused, { runId: payload.runId, code: cause.code })
            await this.closeRun(
                payload.runId,
                payload.workspaceId,
                "failed",
                this.catalog.get("automations.n8n.refused", {}, "vi"),
                null,
            )
        }
    }

    /** The run a bearer token speaks for; null for an unknown run, a wrong token, an expired token or a finished run. */
    async verifyRun(request: RunVerification): Promise<RunContextOrNone> {
        const bearer = parseBearer(request.authorization)
        if (bearer === null || (request.expectedRunId !== undefined && bearer.runId !== request.expectedRunId))
            return null
        const [run] = await this.entityManager.query<Array<N8nRunRow>>(SELECT_N8N_RUN, [bearer.runId])
        if (
            run === undefined ||
            !tokenMatches(run.token_hash, bearer.token) ||
            new Date(run.expires_at).getTime() < this.clock.now().getTime() ||
            !runIsOpen(run.status)
        ) {
            return null
        }
        const [pipeline] = await this.entityManager.query<Array<RunPipelineRow>>(SELECT_RUN_PIPELINE, [
            run.workspace_id,
            run.template_key,
        ])
        return {
            runId: run.id,
            workspaceId: run.workspace_id,
            templateKey: run.template_key,
            config: { ...pipeline?.config, ...(pipeline?.body ? { body: pipeline.body } : {}) },
        }
    }

    /** Closes a run with what n8n reported; the token stops working right after. */
    async completeRun(run: N8nRunContext, report: N8nCompletion): Promise<void> {
        await this.closeRun(
            run.runId,
            run.workspaceId,
            finalStatusOf(report.status),
            summaryOf(report.summary, report.result, (key) => this.countWord(key)),
            boundedResult(report.result),
        )
    }

    /** The run that must belong to a workflow; any other run is refused. */
    requireWorkflow(run: RunContextOrNone, templateKey: string): N8nRunContext {
        if (run === null || run.templateKey !== templateKey) {
            throw new N8nRunsError({ code: N8nRunsErrorCode.WorkflowMismatch })
        }
        return run
    }

    /** The run a request proves with its token; an invalid token is refused. */
    requireRun(run: RunContextOrNone): N8nRunContext {
        if (run === null) throw new N8nRunsError({ code: N8nRunsErrorCode.RunUnauthorized })
        return run
    }

    private async closeRun(
        runId: string,
        workspaceId: string,
        status: string,
        summary: string | null,
        result: Readonly<Record<string, unknown>> | null,
    ): Promise<void> {
        const [closed] = await this.entityManager.query<Array<{ id: string }>>(COMPLETE_N8N_RUN, [
            runId,
            workspaceId,
            status,
            summary,
            result === null ? null : JSON.stringify(result),
        ])
        if (closed === undefined) throw new N8nRunsError({ code: N8nRunsErrorCode.NotClosed })
    }

    /** The words for the counters the shared workflows report (the workflows carry no wording); an unknown counter goes by its name. */
    private countWord(key: string): string {
        const id = `automations.n8nCount.${key}`
        const word = this.catalog.get(id, {}, "vi")
        return word === id ? key : word
    }
}
