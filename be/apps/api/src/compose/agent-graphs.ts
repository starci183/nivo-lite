import type { DynamicModule } from "@nestjs/common"
import { AccountingFactReaderService } from "@modules/domain/accounting"
import { AgentGraphsModule } from "@modules/domain/agent-graphs"

/**
 * The action graph of the API: each agent as a flow the owner can read and change. It binds the branch decider of the work engine, the
 * intents of a turn and the data rights of the gateway. The accounting reader gives the amount of a supplier payment from the payment
 * itself; a fact no reader owns is never read, so its decide point falls to its else until a module's reader is added to `readers`.
 */
export const agentGraphsModules = (): Array<DynamicModule> => [AgentGraphsModule.register({ isGlobal: true, readers: [AccountingFactReaderService] })]
