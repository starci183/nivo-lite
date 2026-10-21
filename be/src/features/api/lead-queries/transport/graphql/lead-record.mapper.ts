import type { LeadView } from "@modules/domain/leads"
import type { LeadRecordType } from "./dto/lead-record.type"

/** Maps a lead from its owner's read contract to the GraphQL contract. */
export const toLeadRecordType = (lead: LeadView): LeadRecordType => ({
    id: lead.id,
    contactName: lead.contact_name,
    company: lead.company,
    channel: lead.channel,
    need: lead.need,
    stage: lead.stage,
    contextSummary: lead.context_summary,
    installationId: lead.installation_id,
    createdAt: lead.created_at,
})
