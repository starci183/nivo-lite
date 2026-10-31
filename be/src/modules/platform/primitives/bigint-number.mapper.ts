import type { ValueTransformer } from "typeorm"

/** Reads a bigint column (text from the driver) as a number and writes the number back; for amounts and points counted in whole units. */
export const bigintNumberTransformer: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}
