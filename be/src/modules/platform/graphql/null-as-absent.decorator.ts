import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"

/** An optional GraphQL input field may arrive as an explicit null; the application reads null and absent alike as absent. */
export const NullAsAbsent = (): PropertyDecorator =>
    Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
