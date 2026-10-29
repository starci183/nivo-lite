import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ScheduleModule, SchedulerRegistry } from "@nestjs/schedule"
import { CronJob } from "cron"
import type { EntityManager } from "typeorm"
import { JobTickService } from "./job-tick.service"
import { JOB_CLAIMS, JOB_FENCE, JOB_PROCESSOR_REGISTRY, JOB_TICK_SCHEDULER, JOBS_MANAGERS } from "./jobs.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./jobs.module-definition"
import { JobClaimService } from "./job-claim.service"
import { JobFenceService } from "./job-fence.service"
import { JobRunnerService } from "./job-runner.service"
import type { JobTickScheduler } from "./jobs.port"

/** The scheduler over the Nest registry: one cron job per tick, started when registered, read in the tick's time zone. */
export const cronSchedulerOf = (registry: SchedulerRegistry): JobTickScheduler => ({
    schedule: (tick, onTick, onError) => {
        registry.addCronJob(
            tick.name,
            CronJob.from({ cronTime: tick.cron, timeZone: tick.timeZone, onTick, errorHandler: onError, start: true }),
        )
    },
})

@Module({})
/** The fenced jobs of a service: the claim service that owns the job row and the runner that subscribes processors to their queues. The recurring ticks start only when `scheduler.enabled`. Needs the queue capability registered in the same app. */
export class JobsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that runs jobs. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), ...(options.scheduler.enabled ? [ScheduleModule.forRoot()] : [])],
            providers: [
                ...(base.providers ?? []),
                {
                    provide: JOBS_MANAGERS,
                    useFactory: (manager: EntityManager) => [manager],
                    inject: [options.connection],
                },
                JobClaimService,
                JobFenceService,
                JobRunnerService,
                ...(options.scheduler.enabled
                    ? [
                          JobTickService,
                          { provide: JOB_TICK_SCHEDULER, useFactory: cronSchedulerOf, inject: [SchedulerRegistry] },
                      ]
                    : []),
                { provide: JOB_CLAIMS, useExisting: JobClaimService },
                { provide: JOB_FENCE, useExisting: JobFenceService },
                { provide: JOB_PROCESSOR_REGISTRY, useExisting: JobRunnerService },
            ],
            exports: [JOB_CLAIMS, JOB_FENCE, JOB_PROCESSOR_REGISTRY],
        }
    }
}
