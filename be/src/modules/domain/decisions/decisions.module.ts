import { WorkDecisionTimeoutService } from "./work-decision-timeout.service"
import { AgentRunItemVerdictsService } from "./agent-run-item-verdicts.service"
import { AGENT_RUN_ITEM_VERDICTS } from "@modules/domain/agent-runs"
import { GraphWorkDecisionService } from "./graph-work-decision.service"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AGENT_DIRECTORY, MessagesModule } from "@modules/domain/messages"
import { ExecutionsModule } from "@modules/domain/executions"
import { AuthorityModule } from "@modules/domain/authority"
import { AuthorityRulesModule } from "@modules/domain/authority-rules"
import { MemberGrantsModule } from "@modules/domain/member-grants"
import { ResponsibilitiesModule } from "@modules/domain/responsibilities"
import { WorkItemsModule } from "@modules/domain/work-items"
import { DecisionsQueueModule } from "@modules/queues/decisions"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { AuthorityGrantsService } from "./authority-grants.service"
import { DecisionJobsService } from "./decision-jobs.service"
import { ApprovalRequesterService } from "./approval-requester.service"
import { CommandBusService } from "./command-bus.service"
import { CommandPlannerService } from "./command-planner.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./decisions.module-definition"
import { DecisionHistoryService } from "./decision-history.service"
import { DecisionLogReadService } from "./decision-log-read.service"
import { DecisionsService } from "./decisions.service"
import { DecisionsFiguresService } from "./decisions-figures.service"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkApprovalService } from "./work-approval.service"
import { WorkItemViewsService } from "./work-item-views.service"
import { WorkBranchService } from "./work-branch.service"
import { WorkItemClosedService } from "./work-item-closed.service"
import { WorkItemRaiseExecutorService } from "./work-item-raise-executor.service"
import { WorkChainService } from "./work-chain.service"
import { WorkDecisionService } from "./work-decision.service"
import { WorkDrainService } from "./work-drain.service"
import { WorkPlacementService } from "./work-placement.service"
import { WorkEngineService } from "./work-engine.service"
import { WorkIntakeService } from "./work-intake.service"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import {
    INBOUND_EVENT_STATUS,
    LEAD_DIRECTORY,
    LEAD_GEN_FLOW,
    MODULE_CATALOG_SOURCE,
    OUTBOUND_ACCESS_GATE,
    THREAD_WORK_HISTORY,
    WORK_CHAINS_HISTORY,
    WORK_THREADS_HISTORY,
} from "./work-engine.decorators"
import { WorkPerformersService } from "./work-performers.service"
import { WorkRecorderService } from "./work-recorder.service"
import { DurableWorkService } from "./durable-work.service"

const decisionOwners = (options: typeof OPTIONS_TYPE): Array<DynamicModule> => [
    AuthorityModule.register({ isGlobal: false }),
    AuthorityRulesModule.register({ isGlobal: false }),
    MemberGrantsModule.register({ isGlobal: false }),
    ExecutionsModule.register({ isGlobal: false }),
    MessagesModule.register({ isGlobal: false, agentDirectory: options.ports.agentDirectory }),
    ResponsibilitiesModule.register({ isGlobal: false, agentDirectory: options.ports.agentDirectory }),
    WorkItemsModule.register({ isGlobal: false, ports: { leads: options.ports.workItemLeads } }),
]

@Module({})
/**
 * The policy gate, the command bus, the work engine and the decision log. It composes the authority, authority-rules, messages,
 * responsibilities and work-items capabilities. The app root provides the ports they read through (the agent directory, the
 * inbound event status, the lead generation flow and the outbound access gate)
 * plus the events and workspace-members capabilities.
 */
export class DecisionsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const owners = decisionOwners(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), ...owners, DecisionsQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                { provide: AGENT_RUN_ITEM_VERDICTS, useExisting: AgentRunItemVerdictsService },
                { provide: WORK_PERFORMER_REGISTRY, useExisting: WorkPerformersService },
                { provide: AGENT_DIRECTORY, useExisting: options.ports.agentDirectory },
                { provide: INBOUND_EVENT_STATUS, useClass: options.ports.inboundEventStatus },
                { provide: LEAD_DIRECTORY, useExisting: options.ports.leadDirectory },
                { provide: LEAD_GEN_FLOW, useExisting: options.ports.leadGenFlow },
                { provide: MODULE_CATALOG_SOURCE, useExisting: options.ports.moduleCatalog },
                { provide: OUTBOUND_ACCESS_GATE, useClass: options.ports.outboundAccessGate },
                { provide: THREAD_WORK_HISTORY, useExisting: options.ports.threadWorkHistory },
                { provide: WORK_CHAINS_HISTORY, useExisting: options.ports.workChainsHistory },
                { provide: WORK_THREADS_HISTORY, useExisting: options.ports.workThreadsHistory },
                ApprovalRequesterService,
                AuthorityGrantsService,
                CommandBusService,
                DecisionJobsService,
                CommandPlannerService,
                DecisionHistoryService,
                DecisionLogReadService,
                AgentRunItemVerdictsService,
                DecisionsService,
                DecisionsFiguresService,
                EvidenceService,
                DurableWorkService,
                ModuleCatalogService,
                WorkApprovalService,
                WorkBranchService,
                WorkItemClosedService,
                WorkItemRaiseExecutorService,
                WorkChainService,
                WorkDecisionService,
                WorkDecisionTimeoutService,
                GraphWorkDecisionService,
                WorkDrainService,
                WorkItemViewsService,
                WorkPlacementService,
                WorkEngineService,
                WorkIntakeService,
                WorkPerformersService,
                WorkRecorderService,
            ],
            exports: [
                AGENT_RUN_ITEM_VERDICTS,
                GraphWorkDecisionService,
                ...owners,
                DecisionsQueueModule,
                WORK_PERFORMER_REGISTRY,
                ApprovalRequesterService,
                AuthorityGrantsService,
                CommandBusService,
                DecisionJobsService,
                DecisionHistoryService,
                DecisionLogReadService,
                DecisionsService,
                DecisionsFiguresService,
                EvidenceService,
                DurableWorkService,
                ModuleCatalogService,
                WorkDecisionService,
                WorkDecisionTimeoutService,
                WorkDrainService,
                WorkItemViewsService,
                WorkPlacementService,
                WorkEngineService,
            ],
        }
    }
}
