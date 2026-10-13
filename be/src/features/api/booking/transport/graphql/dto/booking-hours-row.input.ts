import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, Matches, Max, MaxLength, Min } from "class-validator"

@InputType()
/** Bounded arguments for booking hours row. */
export class BookingHoursRowInput {
    /** The weekday. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(7)
    weekday!: number

    /** The start. */
    @Field(() => String)
    @IsString()
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/u)
    @MaxLength(5)
    start!: string

    /** The end. */
    @Field(() => String)
    @IsString()
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/u)
    @MaxLength(5)
    end!: string
}
