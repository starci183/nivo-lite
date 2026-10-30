import type { ValueTransformer } from "typeorm"

/** Reads the pgmq message id, a Postgres `bigint` the driver returns as text, as a number. */
export const idAsNumber: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null) => (value === null ? null : Number(value)),
}
