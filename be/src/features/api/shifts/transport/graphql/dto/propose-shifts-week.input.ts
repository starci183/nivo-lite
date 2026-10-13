import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that build a draft schedule. */
export class ProposeShiftsWeekInput {
    /** Any day of the week, YYYY-MM-DD. */
    @Field(() => String)
    @IsString()
    @MaxLength(10)
    week!: string
}
