import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One question, without what it scores against. */
export class PublicQuestionType {
    /** The question id. */
    @Field(() => ID)
    id!: string

    /** The question text. */
    @Field(() => String)
    text!: string

    /** The kind of answer. */
    @Field(() => String)
    type!: string

    /** Whether an answer is required. */
    @Field(() => Boolean)
    required!: boolean

    /** The offered choices. */
    @Field(() => [String])
    choices!: ReadonlyArray<string>
}
