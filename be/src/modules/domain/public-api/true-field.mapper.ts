import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"

/** Reads only true and the literal string true as true. */
export const TrueField = (): PropertyDecorator =>
    Transform(({ value }: TransformFnParams): boolean => value === true || value === "true")
