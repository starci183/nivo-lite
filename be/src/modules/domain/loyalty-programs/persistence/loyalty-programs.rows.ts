import type { LoyaltyProgram } from "../loyalty-programs.contracts"
import { resolveConfig } from "../policies/loyalty-config.policy"

/** One row of the programme selects. */
export interface ProgramRow {
    /** The workspace. */
    readonly workspace_id: string
    /** The slug of the public points page. */
    readonly slug: string
    /** The name of the programme. */
    readonly name: string
    /** Whether the programme is on. */
    readonly enabled: boolean
    /** The stored rules, as the owner saved them. */
    readonly config: unknown
    /** When the programme was created. */
    readonly created_at: Date
}

/** The programme a row holds, with its rules resolved over the defaults. */
export const toProgram = (row: ProgramRow): LoyaltyProgram => ({
    workspaceId: row.workspace_id,
    slug: row.slug,
    name: row.name,
    enabled: row.enabled,
    config: resolveConfig(row.config),
    createdAt: row.created_at.toISOString(),
})
