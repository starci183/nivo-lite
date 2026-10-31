import type { ValueTransformer } from "typeorm"

/** Reads the bigint tier credits (text from the driver) as a number, as the request contract always did. */
export const tierTransformer: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}
