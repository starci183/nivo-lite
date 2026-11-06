import { Injectable } from "@nestjs/common"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, ParkWrite } from "@modules/platform/jobs"
import { classifyFailure } from "@modules/platform/queue"
import { isModuleJobPayload, MODULE_JOBS_QUEUE } from "@modules/queues/module-jobs"
import { DOOR_PORT_ID } from "@nivo-lite/agent-sdk/mutation"
import type { JobContext, JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import { runDeclaredJob } from "./declared-job.policy"
import { InjectEngineFailureAlerts, InjectEntityEngineOptions } from "./entity-engine.decorators"
import type { EngineDoorProvider, EngineFailureAlerts, JobPorts, RunIn } from "./entity-engine.contracts"
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

    private door: EngineDoorProvider | null = null

    constructor(
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        @InjectEngineFailureAlerts() private readonly alerts: EngineFailureAlerts,
        @InjectEntityEngineOptions() private readonly options: EntityEngineOptions,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {
        this.jobs = new Map(this.options.jobs.map((job) => [job.name, job]))
    }

    /** The door capability binds itself here at boot; until it does (an app without one), a job that calls the door is parked. */
    bindDoor(provider: EngineDoorProvider): void {
        this.door = provider
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
            await runDeclaredJob(job, this.doorPortsOf(job, payload.workspaceId, context), parsed.data, context)
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

    /**
     * The handles of a job that calls the door: every entity and outbox call opens a scope of its own, and the door handle refuses a call
     * made while one is open. An app that registered no door provider refuses the job: it can call nothing out.
     */
    private doorPortsOf(job: JobDefinition, workspaceId: string, context: JobContext): JobPorts {
        if (this.door === null)
            throw new EntityEngineError({ code: EntityEngineErrorCode.PortUnprovided, params: { id: DOOR_PORT_ID } })
        let open = 0
        const runIn: RunIn = (use) =>
            this.engine.scoped(workspaceId, async (tx) => {
                open += 1
                try {
                    return await use(tx)
                } finally {
                    open -= 1
                }
            })
        const doorNames = Object.entries(job.ports).filter(([, port]) => port.id === DOOR_PORT_ID)
        const rest = Object.fromEntries(Object.entries(job.ports).filter(([, port]) => port.id !== DOOR_PORT_ID))
        const handle = this.door.doorApi({ workspaceId, effectKey: context.effectKey, scopeOpen: () => open > 0 })
        return {
            ...this.ports.portsFor(runIn, "job", rest),
            ...Object.fromEntries(doorNames.map(([name]) => [name, handle])),
        }
    }
}
