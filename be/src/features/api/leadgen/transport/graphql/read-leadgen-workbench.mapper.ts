import type { LeadGenWorkbenchData } from "@modules/domain/leads"
import type { ReadLeadGenWorkbenchRequest } from "../../application/read-leadgen-workbench.contracts"
import type { ReadLeadGenWorkbenchInput } from "./dto/read-leadgen-workbench.input"
import type { LeadGenWorkbenchType } from "./dto/leadgen-workbench.type"

/** Maps the selected workspace and bounded optional instance to the application query. */
export const toReadLeadGenWorkbenchRequest = (
    workspaceId: string,
    input: ReadLeadGenWorkbenchInput,
): ReadLeadGenWorkbenchRequest => ({
    workspaceId,
    installationId: input.installationId,
})

/** Copies the workbench collections into their GraphQL output DTOs. */
export const toLeadGenWorkbenchType = (result: LeadGenWorkbenchData): LeadGenWorkbenchType => ({
    metrics: { ...result.metrics },
    leads: result.leads.map((lead) => ({ ...lead, origin: { ...lead.origin } })),
    leadsHidden: result.leadsHidden,
    sources: result.sources.map((source) => ({ ...source, origin: { ...source.origin } })),
    comments: result.comments.map((comment) => ({ ...comment })),
    handoffs: result.handoffs.map((handoff) => ({ ...handoff })),
})
