import { Field, Int, InputType } from "@nestjs/graphql"
import { IsInt, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The opening hours of one weekday. */
export class OpeningHoursInput {
    /** The weekday, 0 Monday to 6 Sunday. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(6)
    weekday!: number

    /** The opening time, HH:MM. */
    @Field(() => String)
    @IsString()
    @MaxLength(5)
    open!: string

    /** The closing time, HH:MM. */
    @Field(() => String)
    @IsString()
    @MaxLength(5)
    close!: string
}
