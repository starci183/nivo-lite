import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { AutomationOffice, AutomationEvidenceEntry, FollowUp, OptionalLead } from "@modules/domain/automations"
import { EventsService } from "@modules/domain/events"
import { MessagesService } from "@modules/domain/messages"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { InjectPrimaryEntityManager } from "@modules/platform/database"

@Injectable()
/** The Office of a workspace as the automations write to it: a NIVO line in the team chat, the evidence log and follow-up tasks. */
export class AutomationOfficeService implements AutomationOffice {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly messages: MessagesService,
        private readonly events: EventsService,
        private readonly journal: ResponsibilityJournalService,
    ) {}

    /** Posts a NIVO line in Office, optionally about a lead. */
    async postLine(workspaceId: string, body: string, leadId: OptionalLead): Promise<void> {
        await this.messages.postSystem({ workspaceId, leadId, body, manager: this.entityManager })
    }

    /** Appends one line to the evidence log. */
    async logEvidence(workspaceId: string, entry: AutomationEvidenceEntry): Promise<void> {
        await this.events.record({
            workspaceId,
            kind: entry.kind,
            actor: entry.actor,
            summary: entry.summary,
            leadId: entry.leadId ?? null,
            evidence: entry.evidence ?? null,
        })
    }

    /** Opens a follow-up task for a person unless the customer has an open one with the same title. */
    openFollowUp(workspaceId: string, task: FollowUp): Promise<boolean> {
        return this.journal.openNamed(workspaceId, task)
    }
}
