import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"

/** Reads a nullish input value as null. */
export const UndefinedAsNull = (): PropertyDecorator =>
    Transform(({ value }: TransformFnParams): unknown => value ?? null)
