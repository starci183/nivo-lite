import { Field, Int, Float, ObjectType } from "@nestjs/graphql"
import { PublicRequirementsType } from "./public-requirements.type"
import { PublicQuestionType } from "./public-question.type"

@ObjectType()
/** A published job for the apply page. */
export class PublicJobType {
    /** The post title. */
    @Field(() => String)
    title!: string

    /** The position name. */
    @Field(() => String)
    position!: string

    /** How the job is worked. */
    @Field(() => String)
    employmentType!: string

    /** The work schedule. */
    @Field(() => String)
    schedule!: string

    /** The lowest pay. */
    @Field(() => Float, { nullable: true })
    payMinVnd!: number | null

    /** The highest pay. */
    @Field(() => Float, { nullable: true })
    payMaxVnd!: number | null

    /** The unit of the pay. */
    @Field(() => String)
    payUnit!: string

    /** The place of work. */
    @Field(() => String)
    location!: string

    /** How many people are wanted. */
    @Field(() => Int)
    headcount!: number

    /** The description. */
    @Field(() => String)
    description!: string

    /** The status. */
    @Field(() => String)
    status!: string

    /** When applications stop. */
    @Field(() => String, { nullable: true })
    closesAt!: string | null

    /** The business name. */
    @Field(() => String)
    company!: string

    /** The consent text. */
    @Field(() => String)
    consentText!: string

    /** Whether the job takes applications now. */
    @Field(() => Boolean)
    open!: boolean

    /** The written requirements. */
    @Field(() => PublicRequirementsType)
    requirements!: PublicRequirementsType

    /** The questions. */
    @Field(() => [[PublicQuestionType]])
    questions!: ReadonlyArray<PublicQuestionType>
}
