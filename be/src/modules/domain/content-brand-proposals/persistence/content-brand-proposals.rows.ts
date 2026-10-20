import type { BrandProposalStatus } from "../content-brand-proposals.contracts"

/** One stored brand proposal row. */
export interface BrandProposalRow {
    /** The proposal. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The agent instance. */
    readonly installation_id: string | null
    /** The setup draft. */
    readonly setup_session_id: string | null
    /** The file name. */
    readonly file_name: string
    /** The file size. */
    readonly file_size: number
    /** The kit JSON. */
    readonly payload: unknown
    /** Where it stands. */
    readonly status: BrandProposalStatus
    /** Who decided it. */
    readonly decided_by: string | null
    /** When it was read. */
    readonly created_at: string
}
