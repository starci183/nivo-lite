import type { PageRequest } from "@modules/platform/pagination"

/** The workspace selected for the lead board. */
export interface LeadBoardRequest extends PageRequest {
    /** The selected workspace; the service verifies membership. */
    readonly workspaceId: string
}
