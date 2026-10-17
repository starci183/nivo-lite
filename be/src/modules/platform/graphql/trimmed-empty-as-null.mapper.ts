import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"

/** Reads whitespace-only strings as null and preserves every other input value. */
export const TrimmedEmptyAsNull = (): PropertyDecorator =>
    Transform(({ value }: TransformFnParams): unknown =>
        typeof value === "string" && value.trim() === "" ? null : value,
    )
