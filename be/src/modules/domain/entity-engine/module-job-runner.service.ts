import { Injectable } from "@nestjs/common"
import { AgentRunAlertsService } from "@modules/domain/agent-runs"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, ParkWrite } from "@modules/platform/jobs"
import { classifyFailure } from "@modules/platform/queue"
import { isModuleJobPayload, MODULE_JOBS_QUEUE } from "@modules/queues/module-jobs"
import { DOOR_PORT_ID } from "@nivo-lite/agent-sdk/mutation"
import type { JobContext, JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import { runDeclaredJob } from "./declared-job.policy"
import { InjectEntityEngineOptions } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import { EntityEngineService } from "./entity-engine.service"
import { EntityPortsService } from "./entity-ports.service"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"

@Injectable()
/**
 * Runs one delivery of the module-jobs queue: finds the declared job by name, parses its input against the declaration, opens the engine
 * scope of the workspace the job was enqueued in and runs it with its ports. A job that lists the door port calls out, and no transaction
 * spans an external call (BE-PERSISTENCE-6), so its entity and outbox calls each open a scope of their own; every other job runs in one
 * transaction. A transient failure reaches the runner, which fails the delivery so the queue retries it through its attempts; any other
 * failure parks the job (`failed_awaiting_fix`, BE-JOBS-7), raises the one alert of the park through the flow alerts and returns, and
 * `ParkedJobResumerService` hands the job back at boot under a new build, on the sweep tick or on demand.
 */
export class ModuleJobRunnerService {
    private readonly jobs: ReadonlyMap<string, JobDefinition>

    constructor(
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        private readonly alerts: AgentRunAlertsService,
        @InjectEntityEngineOptions() private readonly options: EntityEngineOptions,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {
        this.jobs = new Map(this.options.jobs.map((job) => [job.name, job]))
    }

    /** Runs the declared job the claimed delivery addresses; a failure a retry cannot fix parks the job. */
    async run(claimed: ClaimedJob): Promise<void> {
        try {
            await this.execute(claimed)
        } catch (cause) {
            const failureClass = classifyFailure(cause)
            if (failureClass === "transient") throw cause
            await this.park(claimed, failureClass, cause instanceof Error ? cause.message.slice(0, 200) : "unknown")
        }
    }

    /** Parks the job under the claim's token and raises the one alert of the park. */
    private async park(claimed: ClaimedJob, failureClass: ParkWrite["failureClass"], reason: string): Promise<void> {
        const build = this.options.buildId ?? "unknown"
        const due = await this.claims.park({
            jobId: claimed.jobId,
            expectedFencingToken: claimed.fencingToken,
            failureClass,
            reason,
            build,
            queue: MODULE_JOBS_QUEUE,
        })
        if (due)
            await this.alerts.raise({
                kind: "flow-parked",
                jobId: claimed.jobId,
                flowKind: claimed.kind,
                failureClass,
                reason,
                correlationId: claimed.jobId,
                build,
                action: "resume",
            })
    }

    private async execute(claimed: ClaimedJob): Promise<void> {
        const payload = claimed.payload
        if (!isModuleJobPayload(payload))
            throw new EntityEngineError({
                code: EntityEngineErrorCode.JobPayloadInvalid,
                params: { jobId: claimed.jobId },
            })
        const job = this.jobs.get(payload.job)
        if (job === undefined)
            throw new EntityEngineError({ code: EntityEngineErrorCode.JobUnknown, params: { job: payload.job } })
        const parsed = job.input.safeParse(payload.input)
        if (!parsed.success)
            throw new EntityEngineError({ code: EntityEngineErrorCode.JobInputInvalid, params: { job: job.name } })
        const context: JobContext = {
            workspaceId: payload.workspaceId,
            attempt: claimed.fencingToken,
            effectKey: (step) => `${claimed.jobId}:${step}`,
        }
        if (Object.values(job.ports).some((port) => port.id === DOOR_PORT_ID)) {
            const ports = this.ports.portsFor((use) => this.engine.scoped(payload.workspaceId, use), "job", job.ports)
            await runDeclaredJob(job, ports, parsed.data, context)
            return
        }
        await this.engine.scoped(payload.workspaceId, (tx) =>
            runDeclaredJob(
                job,
                this.ports.portsFor((use) => use(tx), "job", job.ports),
                parsed.data,
                context,
            ),
        )
    }
}
