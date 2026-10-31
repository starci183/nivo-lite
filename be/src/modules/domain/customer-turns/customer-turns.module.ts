import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentKnowledgeModule } from "@modules/domain/agent-knowledge"
import { ConversationOwnershipEventsModule } from "@modules/domain/conversation-ownership-events"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./customer-turns.module-definition"
import { CustomerCorePlanService } from "./customer-core-plan.service"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { CustomerWorkHandlerService } from "./customer-work-handler.service"
import { PaymentClaimsService } from "./payment-claims.service"
import { StaffEscalationService } from "./staff-escalation.service"
import { TurnModulesService } from "./turn-modules.service"
import { TurnPurchasesService } from "./turn-purchases.service"
import { GatewayContextService } from "./gateway-context.service"
import { HubNotesService } from "./hub-notes.service"
import { TurnGatewayToolsService } from "./turn-gateway-tools.service"
import { TurnHandoffService } from "./turn-handoff.service"
import { TurnSourcesService } from "./turn-sources.service"
import { TurnToolAccessService } from "./turn-tool-access.service"

@Module({})
/**
 * What a customer chat turn starts besides the reply: the payment claims, the staff escalation, the purchases, and the connector
 * meta-tools and the agent hand-off the tool bridge serves to OpenClaw, and the handler that answers a customer's wake on the core road
 * (it registers itself with the agent-work drain, and shares the turn code of the conversations capability). The OpenClaw AI step
 * (CustomerTurnRuntimeService) and the outcome handler (CustomerOutcomesService) are plugged into the conversations capability by the
 * app root, which runs the queued turn and delivers the reply; they reach these services, and what an agent knows (agent-knowledge,
 * registered here so the agents capability and the knowledge.search tool read it too), through this global module.
 */
export class CustomerTurnsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app that runs the chat-turn jobs. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [
            PaymentClaimsService,
            StaffEscalationService,
            TurnPurchasesService,
            HubNotesService,
            GatewayContextService,
            TurnGatewayToolsService,
            TurnHandoffService,
            TurnSourcesService,
            TurnToolAccessService,
            TurnModulesService,
            CustomerTurnRuntimeService,
            CustomerCorePlanService,
            CustomerWorkHandlerService,
        ]
        const knowledge = AgentKnowledgeModule.register({ isGlobal: false })
        return {
            ...base,
            imports: [...(base.imports ?? []), knowledge, ConversationOwnershipEventsModule.register({})],
            providers: [...(base.providers ?? []), { provide: INBOX, useClass: InboxService }, ...services],
            exports: [...services, knowledge],
        }
    }
}
