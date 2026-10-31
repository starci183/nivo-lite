import type { ValueTransformer } from "typeorm"

/** Reads a bigint column's text from the driver as a number, keeping null. */
export const numberOfBigint = (value: string | null): number | null => (value === null ? null : Number(value))

/** Writes a number back to a bigint column unchanged, keeping its absence. */
export const bigintOfNumber = (value: number | null | undefined): number | null | undefined => value

/** Reads a bigint column (text from the driver) as a number and writes the number back; for amounts and points counted in whole units. */
export const bigintNumberTransformer: ValueTransformer = { to: bigintOfNumber, from: numberOfBigint }
