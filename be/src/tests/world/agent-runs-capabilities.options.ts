import { Module, type DynamicModule } from "@nestjs/common"
import { WorkItemsService } from "@modules/domain/work-items"
import { AgentRunEngineAlertsService, AgentRunsModule } from "@modules/domain/agent-runs"
import { EntityEngineModule } from "@modules/domain/entity-engine"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { JobsModule } from "@modules/platform/jobs"
import { AGENT_WORK_MODULES } from "./agent-work-capabilities.options"
import { INSTALLED } from "@modules/domain/installed-plugins"

@Module({
    providers: [WorkItemsService],
    exports: [WorkItemsService],
})
class RecordedDecisionsModule {}

/** The key of the proofs that signs the engine's list cursors; synthetic. */
const CURSOR_KEY = new Secret(Buffer.alloc(32, 7).toString("base64"))

/** The agent work store with the run records and the run read on top, as the api composes them (phase 3: no step kernel, no scripted steps). */
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
        entities: INSTALLED.entities(),
        jobs: [],
        alerts: AgentRunEngineAlertsService,
        cursorKey: CURSOR_KEY,
    }),
]
