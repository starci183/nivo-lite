import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One question a job asks its applicants. */
export class HiringJobQuestionType {
    /** The question id inside the job. */
    @Field(() => String)
    id!: string

    /** The question text candidates read. */
    @Field(() => String)
    text!: string

    /** The kind of answer. */
    @Field(() => String)
    type!: string

    /** Whether an answer is required. */
    @Field(() => Boolean)
    required!: boolean

    /** The offered choices of a choice question. */
    @Field(() => [[String]])
    choices!: ReadonlyArray<string>

    /** The expected answer of a yes or no question. */
    @Field(() => String, { nullable: true })
    expectYesNo!: string | null

    /** The minimum of a number question. */
    @Field(() => Float, { nullable: true })
    expectNumber!: number | null

    /** The accepted choices of a choice question. */
    @Field(() => [[String]], { nullable: true })
    expectChoices!: ReadonlyArray<string> | null
}
