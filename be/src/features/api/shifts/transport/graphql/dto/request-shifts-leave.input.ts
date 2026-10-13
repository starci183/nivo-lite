import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that ask for leave. */
export class RequestShiftsLeaveInput {
    /** The first day, YYYY-MM-DD. */
    @Field(() => String)
    @IsString()
    @MaxLength(10)
    from!: string

    /** The last day, YYYY-MM-DD. */
    @Field(() => String)
    @IsString()
    @MaxLength(10)
    to!: string

    /** The reason typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    reason!: string
}
