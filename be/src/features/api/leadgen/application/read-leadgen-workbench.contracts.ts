import type { LeadGenInstallationId } from "@modules/domain/leads"

/** The selected workspace and optional Lead Gen agent instance. */
export interface ReadLeadGenWorkbenchRequest {
    /** The selected workspace; membership is proved before any read or write. */
    readonly workspaceId: string
    /** Optional Lead Gen agent instance that limits this workbench. */
    readonly installationId: LeadGenInstallationId
}
