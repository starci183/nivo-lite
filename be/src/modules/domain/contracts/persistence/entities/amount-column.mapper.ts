import type { ValueTransformer } from "typeorm"

/** Reads the bigint amount as the number the contract carries; the amount is never larger than a safe integer. */
export const amountTransformer: ValueTransformer = {
    to: (value: number | null): number | null => value,
    from: (value: string | number | null): number | null => (value === null ? null : Number(value)),
}
