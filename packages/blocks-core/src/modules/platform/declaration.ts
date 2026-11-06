import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { agentConnectionsRead } from "./reads/agent-connections.read"
import { agentDoneRead } from "./reads/agent-done.read"
import { agentKnowledgeRead } from "./reads/agent-knowledge.read"

/** The key of the platform module: every read id starts with it. */
export const PLATFORM_MODULE_KEY = "platform"

/**
 * The platform module: the reads every agent page needs about its own agent, whatever the agent is: what it finished lately, the
 * connections it acts through and what it knows. It has no screen of its own; the aside of an agent page binds these reads for the
 * collapsed rows "Done", "Connections" and "Knowledge".
 */
export const platformModule: ModuleDeclaration = defineModule({
    key: PLATFORM_MODULE_KEY,
    namespace: PLATFORM_MODULE_KEY,
    permissions: ["platform.view"],
    reads: [agentDoneRead, agentConnectionsRead, agentKnowledgeRead],
    actions: [],
    specs: [],
})
