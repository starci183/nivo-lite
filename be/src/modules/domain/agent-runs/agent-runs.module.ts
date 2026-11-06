import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { WORK_ITEM_CLOSED } from "@modules/domain/work-items"
import { AgentStepQueueModule } from "@modules/queues/agent-step"
import { AgentRunAlertsService } from "./agent-run-alerts.service"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunItemClosedService } from "./agent-run-item-closed.service"
import { AGENT_WAKE_INTERRUPTIONS } from "@modules/domain/agent-work"
import { AgentRunInflightService } from "./agent-run-inflight.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunOwnerResumeService } from "./agent-run-owner-resume.service"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunDueService } from "./agent-run-due.service"
import { AgentRunWorkspacesService } from "./agent-run-workspaces.service"
import { AgentRunParkStoreService } from "./agent-run-park-store.service"
import { AgentRunResumeService } from "./agent-run-resume.service"
import { AgentRunStepsService } from "./agent-run-steps.service"
import { AgentRunReportService } from "./agent-run-report.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunSweepService } from "./agent-run-sweep.service"
import { AgentRunTraceService } from "./agent-run-trace.service"
import { AgentStepJobService } from "./agent-step-job.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsService } from "./agent-runs.service"
import { AGENT_RUNS_OPTIONS } from "./agent-runs.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-runs.module-definition"

@Module({})
/**
 * The durable run of a wake: the run and step records of the entity engine, the engine that drives them, the registry of step handlers and the
 * sweep that repairs what a crash left. It owns the run entities and imports platform and the agent-step queue; the capabilities that own a kind
 * of step register their handler when they start, and the graph binds the timeout of a wait through the wait timeout port.
 */
export class AgentRunsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), AgentStepQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                {
                    provide: AGENT_RUNS_OPTIONS,
                    useValue: {
                        buildId: options.buildId,
                        parkSweepMinutes: options.parkSweepMinutes,
                        parkMaxResumes: options.parkMaxResumes,
                    },
                },
                AgentRunRecordsService,
                AgentRunWorkspacesService,
                AgentRunDueService,
                AgentRunReportService,
                AgentRunStoreService,
                AgentRunParkStoreService,
                AgentRunResumeService,
                AgentRunOwnerResumeService,
                AgentStepLedgerService,
                AgentRunHandlersService,
                AgentRunInflightService,
                AgentRunAlertsService,
                AgentRunDeadLetterService,
                AgentRunCompensationService,
                AgentRunStepsService,
                AgentRunsService,
                AgentRunSweepService,
                AgentRunTraceService,
                AgentStepJobService,
                AgentRunItemClosedService,
                { provide: WORK_ITEM_CLOSED, useExisting: AgentRunItemClosedService },
                { provide: AGENT_WAKE_INTERRUPTIONS, useExisting: AgentRunsService },
            ],
            exports: [
                WORK_ITEM_CLOSED,
                AGENT_WAKE_INTERRUPTIONS,
                AgentStepQueueModule,
                AgentRunsService,
                AgentRunAlertsService,
                AgentRunResumeService,
                AgentRunParkStoreService,
                AgentRunOwnerResumeService,
                AgentRunHandlersService,
                AgentRunSweepService,
                AgentRunTraceService,
                AgentStepJobService,
            ],
        }
    }
}
