import type { Namespaced } from "../schema/schema.types"

/** The longest identifier PostgreSQL keeps. */
export const PARTITION_NAME_MAX = 63

/** The partition of an entity: `records_` and the name with dots and dashes as underscores, at most 63 characters. */
export const partitionNameOf = (name: Namespaced): string =>
    `records_${name.replaceAll(/[.-]/g, "_")}`.slice(0, PARTITION_NAME_MAX)
