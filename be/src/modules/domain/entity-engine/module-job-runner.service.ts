import { Injectable } from "@nestjs/common"
import type { ClaimedJob } from "@modules/platform/jobs"
import { isModuleJobPayload } from "@modules/queues/module-jobs"
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
 * transaction. A failure is not caught: it reaches the runner, which classifies it (transient: the queue retries through attempts).
 */
export class ModuleJobRunnerService {
    private readonly jobs: ReadonlyMap<string, JobDefinition>

    constructor(
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        @InjectEntityEngineOptions() options: EntityEngineOptions,
    ) {
        this.jobs = new Map(options.jobs.map((job) => [job.name, job]))
    }

    /** Runs the declared job the claimed delivery addresses. */
    async run(claimed: ClaimedJob): Promise<void> {
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
