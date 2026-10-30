import type { ValueTransformer } from "typeorm"

/** Reads a bigint or numeric column as the number the contracts carry, and writes it as it is. */
export const numeric: ValueTransformer = {
    to: (value: number | null): number | null => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}
