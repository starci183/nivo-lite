import { forwardRef, Inject, Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { BookingChatLookupService } from "@modules/domain/bookings"
import { LeadFlowStoreService } from "@modules/domain/lead-flows"
import { LeadRecordsService } from "@modules/domain/leads"
import type { RecordInstallation } from "@modules/domain/module-installations"
import { WorkItemsService } from "@modules/domain/work-items"

const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@Injectable()
/** Finds the installation that owns a record of the workspace by asking each capability that keeps records naming an installation. */
export class RecordInstallationService {
    constructor(
        private readonly workItems: WorkItemsService,
        private readonly conversations: AgentConversationsService,
        private readonly bookings: BookingChatLookupService,
        @Inject(forwardRef(() => LeadFlowStoreService)) private readonly flows: LeadFlowStoreService,
        private readonly leads: LeadRecordsService,
    ) {}

    /**
     * The installation that owns a work item, conversation, booking, lead flow or lead of the workspace, the first of those
     * that names one. Null when the id is none of those rows, or the row names no installation.
     */
    async installationOfRecord(workspaceId: string, recordId: string): Promise<RecordInstallation> {
        if (!RECORD_ID.test(recordId)) return { installationId: null }
        const found = await Promise.all([
            this.workItems.installationIdOf(workspaceId, recordId),
            this.conversations.installationIdOf(workspaceId, recordId),
            this.bookings.installationIdOf(workspaceId, recordId),
            this.flows.installationIdOf(workspaceId, recordId),
            this.leads.installationIdOf(workspaceId, recordId),
        ])
        return { installationId: found.find((installationId) => installationId !== null) ?? null }
    }
}
