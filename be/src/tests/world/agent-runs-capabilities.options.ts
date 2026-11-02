import { Module } from "@nestjs/common"
import { AgentRunItemVerdictsService, DecisionLogReadService } from "@modules/domain/decisions"
import { WorkItemsDecisionsReadService, WorkItemsService } from "@modules/domain/work-items"
import { AGENT_RUN_ITEM_VERDICTS, AgentRunsModule } from "@modules/domain/agent-runs"
import { AGENT_WORK_MODULES } from "./agent-work-capabilities.options"
import { ScriptedRunsModule } from "./agent-runs-script.service"
import { WaitsExtensionModule } from "./agent-runs-waits.module"
import { API_APP_MODULES } from "./api-app.options"

@Module({
    providers: [
        DecisionLogReadService,
        WorkItemsService,
        WorkItemsDecisionsReadService,
        AgentRunItemVerdictsService,
        { provide: AGENT_RUN_ITEM_VERDICTS, useExisting: AgentRunItemVerdictsService },
    ],
    exports: [DecisionLogReadService, WorkItemsService, WorkItemsDecisionsReadService, AGENT_RUN_ITEM_VERDICTS],
})
class RecordedDecisionsModule {}

/** The agent work store with the runs on top, as the api composes them, and a scripted world for the steps to act on. */
export const AGENT_RUNS_MODULES = [
    ...AGENT_WORK_MODULES,
    { module: RecordedDecisionsModule, global: true },
    AgentRunsModule.register({ isGlobal: true }),
    ScriptedRunsModule.register(),
]

/** The actual API owners with new engine-extension subjects; no verdict or timeout substitution. */
export const WAIT_RUNS_MODULES = [...API_APP_MODULES, WaitsExtensionModule.register()]
