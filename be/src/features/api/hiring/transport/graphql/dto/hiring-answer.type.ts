import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One answer a candidate gave. */
export class HiringAnswerType {
    /** The question id. */
    @Field(() => String)
    questionId!: string

    /** The question text at the time. */
    @Field(() => String)
    question!: string

    /** The answer. */
    @Field(() => String)
    answer!: string
}
