import type { LoyaltyProgram } from "../loyalty-programs.contracts"
import type { LoyaltyProgramEntity } from "../persistence/entities"
import { resolveConfig } from "./loyalty-config.policy"

/** The columns of a programme the mapper reads, named as the entity names them; a write answers exactly these. */
export type ProgramFields = Pick<
    LoyaltyProgramEntity,
    "workspaceId" | "slug" | "name" | "enabled" | "config" | "createdAt"
>

/** The programme a stored row holds, with its rules resolved over the defaults. */
export const toProgram = (row: ProgramFields): LoyaltyProgram => ({
    workspaceId: row.workspaceId,
    slug: row.slug,
    name: row.name,
    enabled: row.enabled,
    config: resolveConfig(row.config),
    createdAt: row.createdAt.toISOString(),
})
