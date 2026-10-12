import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AuthorityModule } from "@modules/domain/authority"
import { AuthorityRulesModule } from "@modules/domain/authority-rules"
import { MessagesModule } from "@modules/domain/messages"
import { ResponsibilitiesModule } from "@modules/domain/responsibilities"
import { WorkItemsModule } from "@modules/domain/work-items"
import { CommandBusService } from "./command-bus.service"
import { CommandPlannerService } from "./command-planner.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./decisions.module-definition"
import { DecisionsService } from "./decisions.service"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkApprovalService } from "./work-approval.service"
import { WorkChainService } from "./work-chain.service"
import { WorkDecisionService } from "./work-decision.service"
import { WorkEngineService } from "./work-engine.service"
import { WorkIntakeService } from "./work-intake.service"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import { WorkPerformersService } from "./work-performers.service"
import { WorkRecorderService } from "./work-recorder.service"

@Module({})
/**
 * The policy gate, the command bus, the work engine and the decision log. It composes the authority, authority-rules, messages,
 * responsibilities and work-items capabilities. The app root provides the ports they read through (the agent directory, the
 * inbound event status, the decision events, the payment receipts, the lead generation flow and the outbound access gate)
 * plus the events and workspace-members capabilities.
 */
export class DecisionsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [
                ...(base.imports ?? []),
                AuthorityModule.register({ isGlobal: false }),
                AuthorityRulesModule.register({ isGlobal: false }),
                MessagesModule.register({ isGlobal: false }),
                ResponsibilitiesModule.register({ isGlobal: false }),
                WorkItemsModule.register({ isGlobal: false }),
            ],
            providers: [
                ...(base.providers ?? []),
                { provide: WORK_PERFORMER_REGISTRY, useExisting: WorkPerformersService },
                CommandBusService,
                CommandPlannerService,
                DecisionsService,
                EvidenceService,
                ModuleCatalogService,
                WorkApprovalService,
                WorkChainService,
                WorkDecisionService,
                WorkEngineService,
                WorkIntakeService,
                WorkPerformersService,
                WorkRecorderService,
            ],
            exports: [
                WORK_PERFORMER_REGISTRY,
                CommandBusService,
                DecisionsService,
                EvidenceService,
                ModuleCatalogService,
                WorkDecisionService,
                WorkEngineService,
            ],
        }
    }
}
