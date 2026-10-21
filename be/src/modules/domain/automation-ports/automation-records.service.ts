import { Injectable } from "@nestjs/common"
import type { AutomationRecords, AutomationNewLead } from "@modules/domain/automations"
import { ContractsService } from "@modules/domain/contracts"
import { LeadRecordsService } from "@modules/domain/leads"

/** The company of a customer known by name only. */
const NO_COMPANY = "—"

@Injectable()
/** The lead and contract records the automations create or change, through the capabilities that own them. */
export class AutomationRecordsService implements AutomationRecords {
    constructor(
        private readonly leads: LeadRecordsService,
        private readonly contracts: ContractsService,
    ) {}

    /** Creates a live lead for a customer known by name only, moved to the stage asked for, and answers its id. */
    async createLead(workspaceId: string, lead: AutomationNewLead): Promise<string> {
        const created = await this.leads.capture({
            workspaceId,
            contactName: lead.contactName,
            company: NO_COMPANY,
            channel: lead.channel,
            need: lead.need,
            phone: null,
            email: null,
        })
        await this.leads.classify({ workspaceId, leadId: created.id, stage: lead.stage, contextSummary: null })
        return created.id
    }

    /** Attaches a lead to a contract that had none. */
    attachContractLead(workspaceId: string, contractId: string, leadId: string): Promise<void> {
        return this.contracts.attachLead(workspaceId, contractId, leadId)
    }
}
