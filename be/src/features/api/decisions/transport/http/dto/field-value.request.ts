import { IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator"

/** One named field of a proposal or a command payload, carrying a text or a number. */
export class FieldValueRequest {
    /** The field name, as the action declares it. */
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(60)
    name!: string

    /** The text value; absent for a number or an empty field. */
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    text?: string

    /** The number value; absent for a text or an empty field. */
    @IsOptional()
    @IsNumber({ allowNaN: false, allowInfinity: false })
    @Min(-1000000000000)
    @Max(1000000000000)
    number?: number
}
