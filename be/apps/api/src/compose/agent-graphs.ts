import type { DynamicModule } from "@nestjs/common"
import { AgentGraphsModule } from "@modules/domain/agent-graphs"

/**
 * The action graph of the API: each agent as a flow the owner can read and change. It binds the branch decider of the work engine, the
 * intents of a turn and the data rights of the gateway; no module declares graph facts yet, so every fact is unread and a decide
 * point falls to its else until a module's reader is added to `readers`.
 */
export const agentGraphsModules = (): Array<DynamicModule> => [AgentGraphsModule.register({ isGlobal: true, readers: [] })]
