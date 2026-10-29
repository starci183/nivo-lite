import type { ValueTransformer } from "typeorm"

/** A bigint column the capability reads as a number, the way the old `::float8` cast answered it. */
export const numberColumn: ValueTransformer = {
    to: (value: number | undefined): number | undefined => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}
