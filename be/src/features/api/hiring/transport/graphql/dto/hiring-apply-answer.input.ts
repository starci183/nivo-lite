import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** One answer. */
export class HiringApplyAnswerInput {
    /** The question id. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    questionId!: string

    /** The answer. */
    @Field(() => String)
    @IsString()
    @MaxLength(4000)
    answer!: string
}
