import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import { ApprovalDecidingService } from "./approval-deciding.service"
import { ApprovalEscalationService } from "./approval-escalation.service"
import { ApprovalOpeningService } from "./approval-opening.service"
import { APPROVAL_AGENT_OWNERS, APPROVAL_EVENTS } from "./approval-requests.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./approval-requests.module-definition"
import { ApprovalRequestsService } from "./approval-requests.service"
import { ApprovalSweepService } from "./approval-sweep.service"
import { EvidenceApprovalEvents } from "./evidence-approval-events.service"
import { UnassignedApprovalAgentOwners } from "./unassigned-agent-owners.service"

@Module({})
/**
 * Requests for approval of the steps an agent cannot finish alone. The agent owners port defaults to nobody (so the workspace owner)
 * until the app root binds the agents capability; the events port defaults to the evidence log. The authority rules, the member
 * grants, the events and the platform capabilities come from the app root.
 */
export class ApprovalRequestsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: APPROVAL_AGENT_OWNERS,
                    useClass: options.ports.agentOwners ?? UnassignedApprovalAgentOwners,
                },
                { provide: APPROVAL_EVENTS, useClass: options.ports.events ?? EvidenceApprovalEvents },
                ApprovalAnnouncerService,
                ApprovalEscalationService,
                ApprovalOpeningService,
                ApprovalDecidingService,
                ApprovalSweepService,
                ApprovalRequestsService,
            ],
            exports: [ApprovalRequestsService],
        }
    }
}
