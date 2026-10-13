import type { LeadGenWorkbench, LeadGenWorkbenchSelection } from "@modules/domain/leadgen-workbench"
import type { LeadGenWorkbenchInput } from "./dto/leadgen-workbench.input"
import type { LeadGenWorkbenchType } from "./dto/leadgen-workbench.type"

/** Maps the header workspace and optional installation selection to the application request. */
export const toReadLeadGenWorkbenchRequest = (
    workspaceId: string,
    input: LeadGenWorkbenchInput | undefined,
): LeadGenWorkbenchSelection => ({ workspaceId, installationId: input?.installationId })

/** Maps the domain projection to the GraphQL workbench without an envelope. */
export const toLeadGenWorkbenchType = (result: LeadGenWorkbench): LeadGenWorkbenchType => ({
    metrics: { ...result.metrics },
    leads: result.leads.map((lead) => ({ ...lead, origin: { ...lead.origin } })),
    leadsHidden: result.leadsHidden,
    sources: result.sources.map((source) => ({ ...source, origin: { ...source.origin } })),
    comments: result.comments.map((comment) => ({ ...comment })),
    handoffs: result.handoffs.map((handoff) => ({ ...handoff })),
})
