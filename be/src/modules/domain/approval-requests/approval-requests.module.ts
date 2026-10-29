import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import { ApprovalDecidingService } from "./approval-deciding.service"
import { ApprovalEscalationService } from "./approval-escalation.service"
import { ApprovalOpeningService } from "./approval-opening.service"
import { APPROVAL_AGENT_OWNERS } from "./approval-requests.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./approval-requests.module-definition"
import { ApprovalRequestsService } from "./approval-requests.service"
import { ApprovalSweepService } from "./approval-sweep.service"
import { ApprovalEvidenceService } from "./approval-evidence.service"

@Module({})
/**
 * Requests for approval of the steps an agent cannot finish alone. The app root binds the agent owners port to the agents
 * capability; every settled request and every reminder is written to the evidence log, and a settled request is published as
 * `approval_resolved` in its own transaction for the work threads to follow. The authority rules, the member grants, the events and
 * the platform capabilities come from the app root.
 */
export class ApprovalRequestsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: APPROVAL_AGENT_OWNERS, useExisting: options.ports.agentOwners },
                ApprovalEvidenceService,
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
