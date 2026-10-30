import type { ValueTransformer } from "typeorm"

/** Reads the fencing token, a Postgres `bigint` the driver returns as text, as the number the claim contracts carry. */
export const tokenAsNumber: ValueTransformer = {
    to: (value: number | undefined) => value,
    from: Number,
}
