import type { SystemField } from "./entity.types"

/** The record columns every entity has; their names are reserved and never declared as fields. */
export const SYSTEM_FIELDS: ReadonlyArray<SystemField> = ["id", "workspaceId", "version", "createdAt", "updatedAt"]
