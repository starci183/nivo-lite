import { Module, type DynamicModule } from "@nestjs/common"
import { AgentRunAlertsService } from "./agent-run-alerts.service"
import { AgentRunCancelService } from "./agent-run-cancel.service"
import { AgentRunsLimitService } from "./agent-runs-limit.service"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AGENT_RUN_TABLE_STORE } from "./agent-run-table-store.port"
import { TypeormAgentRunTableStore } from "./agent-run-table-store.typeorm"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsViewService } from "./agent-runs-view.service"
import { AgentRunsService } from "./agent-runs.service"
import { AGENT_RUNS_OPTIONS } from "./agent-runs.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-runs.module-definition"

@Module({})
/**
 * The runs and steps of the agents on their core tables (public.agent_runs, agent_run_steps): one run per wake (opened by the graph flows and the inbound door), the
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
                { provide: AGENT_RUNS_OPTIONS, useValue: { concurrency: options.concurrency, workspaceConcurrency: options.workspaceConcurrency } },
                // The runs and steps (public.agent_runs, agent_run_steps): the one store every run and step read and write goes through.
                TypeormAgentRunTableStore,
                { provide: AGENT_RUN_TABLE_STORE, useExisting: TypeormAgentRunTableStore },
                AgentRunRecordsService,
                AgentRunStoreService,
                AgentRunCancelService,
                AgentRunsLimitService,
                AgentRunAlertsService,
                AgentRunsService,
                AgentRunsViewService,
            ],
            exports: [
                AGENT_RUN_TABLE_STORE,
                AgentRunRecordsService,
                AgentRunsService,
                AgentRunAlertsService,
                AgentRunCancelService,
                AgentRunsLimitService,
                AgentRunsViewService,
            ],
        }
    }
}
