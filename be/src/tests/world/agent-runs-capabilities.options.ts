import { AgentRunsModule } from "../../modules/domain/agent-runs"
import { AGENT_WORK_MODULES } from "./agent-work-capabilities.options"
import { ScriptedRunsModule } from "./agent-runs-script.service"

/** The agent work store with the runs on top, as the api composes them, and a scripted world for the steps to act on. */
export const AGENT_RUNS_MODULES = [
    ...AGENT_WORK_MODULES,
    AgentRunsModule.register({ isGlobal: true }),
    ScriptedRunsModule.register(),
]
