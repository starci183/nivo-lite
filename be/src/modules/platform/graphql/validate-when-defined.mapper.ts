import { ValidateIf } from "class-validator"

/** Validates supplied values, including null, while leaving undefined optional. */
export const ValidateWhenDefined = (): PropertyDecorator =>
    ValidateIf((_input: object, value: unknown) => value !== undefined)
