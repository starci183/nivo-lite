import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentStepQueueModule } from "@modules/queues/agent-step"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunStepsService } from "./agent-run-steps.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunSweepService } from "./agent-run-sweep.service"
import { AgentRunTraceService } from "./agent-run-trace.service"
import { AgentStepJobService } from "./agent-step-job.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsService } from "./agent-runs.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-runs.module-definition"

@Module({})
/**
 * The durable run of a wake: the tables of the runs and their steps, the engine that drives them, the registry of step handlers and the
 * sweep that repairs what a crash left. It owns the tables and imports platform and the agent-step queue; the capabilities that own a kind
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
                AgentRunStoreService,
                AgentStepLedgerService,
                AgentRunHandlersService,
                AgentRunDeadLetterService,
                AgentRunCompensationService,
                AgentRunStepsService,
                AgentRunsService,
                AgentRunSweepService,
                AgentRunTraceService,
                AgentStepJobService,
            ],
            exports: [
                AgentStepQueueModule,
                AgentRunsService,
                AgentRunHandlersService,
                AgentRunSweepService,
                AgentRunTraceService,
                AgentStepJobService,
            ],
        }
    }
}
