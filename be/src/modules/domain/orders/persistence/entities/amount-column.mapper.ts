import type { ValueTransformer } from "typeorm"

/** Reads the bigint amount (text from the driver) as a number, as the order contract always did. */
export const amountTransformer: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}
