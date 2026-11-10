import { WorkDecisionTimeoutService } from "./work-decision-timeout.service"
import { GraphWorkDecisionService } from "./graph-work-decision.service"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AuthorityModule } from "@modules/domain/authority"
import { AuthorityRulesModule } from "@modules/domain/authority-rules"
import { MemberGrantsModule } from "@modules/domain/member-grants"
import { WorkItemsModule } from "@modules/domain/work-items"
import { DecisionsQueueModule } from "@modules/queues/decisions"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ApprovalRequesterService } from "./approval-requester.service"
import { AuthorityGrantsService } from "./authority-grants.service"
import { CommandBusService } from "./command-bus.service"
import { CommandPlannerService } from "./command-planner.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./decisions.module-definition"
import { DecisionsService } from "./decisions.service"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkApprovalService } from "./work-approval.service"
import { DecisionLogReadService } from "./decision-log-read.service"
import { WorkItemViewsService } from "./work-item-views.service"
import { WorkBranchService } from "./work-branch.service"
import { WorkItemClosedService } from "./work-item-closed.service"
import { WorkItemRaiseExecutorService } from "./work-item-raise-executor.service"
import { WorkItemWithdrawExecutorService } from "./work-item-withdraw-executor.service"
import { WorkChainService } from "./work-chain.service"
import { WorkDecisionService } from "./work-decision.service"
import { WorkPlacementService } from "./work-placement.service"
import { WorkEngineService } from "./work-engine.service"
import { WorkIntakeService } from "./work-intake.service"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import {
    INBOUND_EVENT_STATUS,
    MODULE_CATALOG_SOURCE,
    OUTBOUND_ACCESS_GATE,
    WORK_AGENT_DIRECTORY,
    WORK_ASK_CARDS,
} from "./work-engine.decorators"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import { WorkLinesService } from "./work-lines.service"
import { WorkPerformersService } from "./work-performers.service"
import { WorkRecorderService } from "./work-recorder.service"
import { DurableWorkService } from "./durable-work.service"

const decisionOwners = (): Array<DynamicModule> => [
    AuthorityModule.register({ isGlobal: false }),
    AuthorityRulesModule.register({ isGlobal: false }),
    MemberGrantsModule.register({ isGlobal: false }),
    WorkItemsModule.register({ isGlobal: false }),
]

@Module({})
/**
 * The policy gate, the command bus, the work engine and the decision log. It composes the authority, authority-rules, messages,
 * and work-items capabilities. The app root provides the ports they read through (the agent directory, the
 * inbound event status, the lead generation flow and the outbound access gate)
 * plus the events and workspace-members capabilities.
 */
export class DecisionsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const owners = decisionOwners()
        return {
            ...base,
            imports: [...(base.imports ?? []), ...owners, DecisionsQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                { provide: WORK_PERFORMER_REGISTRY, useExisting: WorkPerformersService },
                { provide: WORK_AGENT_DIRECTORY, useExisting: options.ports.agentDirectory },
                { provide: WORK_ASK_CARDS, useExisting: TeamChatRoomsService },
                { provide: INBOUND_EVENT_STATUS, useClass: options.ports.inboundEventStatus },
                { provide: MODULE_CATALOG_SOURCE, useExisting: options.ports.moduleCatalog },
                { provide: OUTBOUND_ACCESS_GATE, useClass: options.ports.outboundAccessGate },
                ApprovalRequesterService,
                AuthorityGrantsService,
                CommandBusService,
                CommandPlannerService,
                DecisionsService,
                EvidenceService,
                DurableWorkService,
                ModuleCatalogService,
                WorkApprovalService,
                WorkChainService,
                WorkBranchService,
                WorkItemClosedService,
                WorkItemRaiseExecutorService,
                WorkItemWithdrawExecutorService,
                WorkDecisionService,
                WorkDecisionTimeoutService,
                GraphWorkDecisionService,
                DecisionLogReadService,
                WorkItemViewsService,
                WorkPlacementService,
                WorkEngineService,
                WorkIntakeService,
                WorkPerformersService,
                WorkLinesService,
                WorkRecorderService,
            ],
            exports: [
                GraphWorkDecisionService,
                ...owners,
                DecisionsQueueModule,
                WORK_PERFORMER_REGISTRY,
                ApprovalRequesterService,
                AuthorityGrantsService,
                CommandBusService,
                DecisionsService,
                EvidenceService,
                DurableWorkService,
                ModuleCatalogService,
                WorkDecisionService,
                WorkDecisionTimeoutService,
                DecisionLogReadService,
                WorkItemViewsService,
                WorkPlacementService,
                WorkEngineService,
            ],
        }
    }
}
