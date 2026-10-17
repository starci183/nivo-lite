import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import { trimmedField } from "./public-api.policy"

/** Applies the public API text and numeric field conversion. */
export const TrimmedField = (): PropertyDecorator =>
    Transform(({ value }: TransformFnParams): unknown => trimmedField(value))
