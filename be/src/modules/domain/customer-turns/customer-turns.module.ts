import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentKnowledgeModule } from "@modules/domain/agent-knowledge"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./customer-turns.module-definition"
import { PaymentClaimsService } from "./payment-claims.service"
import { StaffEscalationService } from "./staff-escalation.service"
import { TurnModulesService } from "./turn-modules.service"
import { TurnPurchasesService } from "./turn-purchases.service"

@Module({})
/**
 * What a customer chat turn starts besides the reply: the payment claims, the staff escalation and the purchases. The OpenClaw AI step
 * (CustomerTurnRuntimeService) and the outcome handler (CustomerOutcomesService) are plugged into the conversations capability by the
 * app root, which runs the queued turn and delivers the reply; they reach these services, and what an agent knows (agent-knowledge,
 * registered here so the agents capability and the knowledge.search tool read it too), through this global module.
 */
export class CustomerTurnsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app that runs the chat-turn jobs. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [PaymentClaimsService, StaffEscalationService, TurnPurchasesService, TurnModulesService]
        const knowledge = AgentKnowledgeModule.register({ isGlobal: false })
        return {
            ...base,
            imports: [...(base.imports ?? []), knowledge],
            providers: [...(base.providers ?? []), ...services],
            exports: [...services, knowledge],
        }
    }
}
