import { Module, type DynamicModule } from "@nestjs/common"
import { CHECKPOINT_STORE } from "@modules/integrations/langgraph"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-checkpoints.module-definition"
import { AgentCheckpointsService } from "./agent-checkpoints.service"

@Module({})
/** The rows of every LangGraph thread; it provides the store the checkpoint saver of `integrations/langgraph` writes through. */
export class AgentCheckpointsModule extends ConfigurableModuleClass {
    /** Registers the capability; register it global so the LangGraph integration's saver finds `CHECKPOINT_STORE`. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                AgentCheckpointsService,
                { provide: CHECKPOINT_STORE, useExisting: AgentCheckpointsService },
            ],
            exports: [AgentCheckpointsService, CHECKPOINT_STORE],
        }
    }
}
