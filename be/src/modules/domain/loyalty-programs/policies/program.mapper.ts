import { isRecord } from "@modules/platform/primitives"
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

const isProgramFields = (value: unknown): value is ProgramFields =>
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    typeof value.enabled === "boolean" &&
    isRecord(value.config) &&
    value.createdAt instanceof Date

/** The programme row a returning clause answered first, or undefined when it answered none or a malformed one. */
export const firstProgramRow = (raw: unknown): ProgramFields | undefined => {
    const [row]: Array<unknown> = Array.isArray(raw) ? raw : []
    return isProgramFields(row) ? row : undefined
}
