import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentRunAlertsService } from "./agent-run-alerts.service"
import { AgentRunCancelService } from "./agent-run-cancel.service"
import { AgentRunsLimitService } from "./agent-runs-limit.service"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsViewService } from "./agent-runs-view.service"
import { AgentRunsService } from "./agent-runs.service"
import { AGENT_RUNS_OPTIONS } from "./agent-runs.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-runs.module-definition"

@Module({})
/**
 * The runs and steps of the agents as records of the entity engine: one run per wake (opened by the graph flows and the inbound door), the
 * thread projection's rows read back by the run page, the thread runs and the stop door, the owner's cancel and the run alerts. The engine
 * that moves a run is the LangGraph thread (agent-threads); nothing here drives a step.
 */
export class AgentRunsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: AGENT_RUNS_OPTIONS, useValue: { concurrency: options.concurrency } },
                AgentRunRecordsService,
                AgentRunStoreService,
                AgentRunCancelService,
                AgentRunsLimitService,
                AgentRunAlertsService,
                AgentRunsService,
                AgentRunsViewService,
            ],
            exports: [AgentRunsService, AgentRunAlertsService, AgentRunCancelService, AgentRunsLimitService, AgentRunsViewService],
        }
    }
}
