import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { GraphNodeEffectsService } from "./graph-node-effects.service"
import { GraphNodeHostService } from "./graph-node-host.service"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { GraphNodeRunTokensService } from "./graph-node-run-tokens.service"
import {
    GRAPH_EFFECT_ONCE,
    GRAPH_NODE_AGENT_LOOPS,
    GRAPH_NODES_OPTIONS,
    GRAPH_NODE_MODEL,
    GRAPH_NODE_TOOL_DOOR,
} from "./graph-nodes.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./graph-nodes.module-definition"

@Module({})
/**
 * The host of the graph nodes: the install the app assembled, the registry where modules add the data port of each kind and the
 * executor of each effect, the ledger that makes an effect act once, and the host that runs a node through the SDK's runner. It names
 * no domain; its tool door is the NIVO MCP gateway, and the app root binds the model door.
 */
export class GraphNodesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: GRAPH_NODES_OPTIONS,
                    useValue: {
                        install: options.install,
                        model: options.model,
                        tools: options.tools,
                        agentLoop: options.agentLoop,
                    },
                },
                { provide: GRAPH_NODE_MODEL, useExisting: options.model },
                GraphNodeRegistryService,
                GraphNodeEffectsService,
                GraphNodeHostService,
                GraphNodeRunTokensService,
                { provide: GRAPH_NODE_TOOL_DOOR, useClass: options.tools },
                { provide: GRAPH_EFFECT_ONCE, useExisting: GraphNodeEffectsService },
                ...(options.agentLoop?.loops === undefined
                    ? []
                    : [{ provide: GRAPH_NODE_AGENT_LOOPS, useExisting: options.agentLoop.loops }]),
            ],
            exports: [GraphNodeRegistryService, GraphNodeHostService, GraphNodeRunTokensService, GRAPH_EFFECT_ONCE],
        }
    }
}
