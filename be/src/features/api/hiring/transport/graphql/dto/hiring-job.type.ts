import { Field, ID, Int, Float, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"
import { HiringJobRequirementsType } from "./hiring-job-requirements-view.type"
import { HiringJobQuestionType } from "./hiring-job-question-view.type"

@ObjectType()
/** One job of the workbench, with its generated ads and its public link. */
export class HiringJobType {
    /** The job id. */
    @Field(() => ID)
    id!: string

    /** The workspace. */
    @Field(() => ID)
    workspaceId!: string

    /** The slug in the public link. */
    @Field(() => String)
    slug!: string

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

    /** The lowest pay, when stated. */
    @Field(() => Float, { nullable: true })
    payMinVnd!: number | null

    /** The highest pay, when stated. */
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

    /** The requirements. */
    @Field(() => HiringJobRequirementsType)
    requirements!: HiringJobRequirementsType

    /** The questions. */
    @Field(() => [HiringJobQuestionType])
    questions!: ReadonlyArray<HiringJobQuestionType>

    /** The status. */
    @Field(() => String)
    status!: string

    /** The channels the job takes applications from. */
    @Field(() => [String])
    channels!: ReadonlyArray<string>

    /** When the job stops taking applications. */
    @Field(() => String, { nullable: true })
    closesAt!: string | null

    /** The generated ad texts, when made. */
    @Field(() => GraphqlJsonObject, { nullable: true })
    adVariants!: object | null

    /** When the job was created. */
    @Field(() => String)
    createdAt!: string

    /** When the job was last edited. */
    @Field(() => String)
    updatedAt!: string

    /** The public link, or null while the workspace has no public slug. */
    @Field(() => String, { nullable: true })
    publicUrl!: string | null
}
