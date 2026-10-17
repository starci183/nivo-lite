import { ValidateIf } from "class-validator"

/** Validates every value except an explicit null. */
export const ValidateWhenNotNull = (): PropertyDecorator =>
    ValidateIf((_input: object, value: unknown) => value !== null)
