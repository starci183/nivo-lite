import { Module, type DynamicModule } from "@nestjs/common"
import { AgentRunItemVerdictsService, DecisionLogReadService } from "@modules/domain/decisions"
import { WorkItemsDecisionsReadService, WorkItemsService } from "@modules/domain/work-items"
import { AGENT_RUN_ITEM_VERDICTS, AgentRunEngineAlertsService, AgentRunsModule } from "@modules/domain/agent-runs"
import { EntityEngineModule } from "@modules/domain/entity-engine"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { JobsModule } from "@modules/platform/jobs"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
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

/** The key of the proofs that signs the engine's list cursors; synthetic. */
const CURSOR_KEY = new Secret(Buffer.alloc(32, 7).toString("base64"))

/** The agent work store with the runs on top, as the api composes them, and a scripted world for the steps to act on. */
export const AGENT_RUNS_MODULES: Array<DynamicModule> = [
    ...AGENT_WORK_MODULES,
    { module: RecordedDecisionsModule, global: true },
    JobsModule.register({
        isGlobal: true,
        connection: PRIMARY_ENTITY_MANAGER,
        workerId: "agent-runs-proof",
        leaseMs: 100,
        scheduler: { enabled: false },
    }),
    AgentRunsModule.register({ isGlobal: true }),
    EntityEngineModule.register({
        isGlobal: true,
        entities: FLOW_F_ENTITIES,
        jobs: [],
        alerts: AgentRunEngineAlertsService,
        cursorKey: CURSOR_KEY,
    }),
    ScriptedRunsModule.register(),
]

/** The actual API owners with new engine-extension subjects; no verdict or timeout substitution. */
export const WAIT_RUNS_MODULES: Array<DynamicModule> = [...API_APP_MODULES, WaitsExtensionModule.register()]
