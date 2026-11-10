import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentLoopClient } from "./agent-loop/agent-loop.client"
import { AGENT_LOOPS } from "./agent-loop/agent-loop.decorators"
import { LanggraphClient } from "./langgraph.client"
import { GRAPH_CHECKPOINTS, GRAPH_THREADS } from "./langgraph.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./langgraph.module-definition"
import { CheckpointSaverClient } from "./persistence/checkpoint-saver.client"

@Module({})
/**
 * The LangGraph integration: the one owner of `@langchain/langgraph`. It gives the engine the threads port (`InjectGraphThreads`)
 * over the checkpoint saver of its `persistence` folder, and the agent loop of its `agent-loop` folder (`InjectAgentLoops`). The saver reads and writes its rows through the `CHECKPOINT_STORE` token,
 * which this module does not provide: the capability that owns the checkpoint tables does, visible to this module (a global
 * provider, or that capability's module among the imports of the app that composes both).
 */
export class LanggraphModule extends ConfigurableModuleClass {
    /** Registers the threads port once per app that runs threads. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                CheckpointSaverClient,
                { provide: GRAPH_CHECKPOINTS, useExisting: CheckpointSaverClient },
                LanggraphClient,
                { provide: GRAPH_THREADS, useExisting: LanggraphClient },
                AgentLoopClient,
                { provide: AGENT_LOOPS, useExisting: AgentLoopClient },
            ],
            exports: [GRAPH_THREADS, GRAPH_CHECKPOINTS, AGENT_LOOPS],
        }
    }
}
