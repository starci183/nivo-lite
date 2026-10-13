import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One onboarding step. */
export class HiringOnboardingType {
    /** The item id. */
    @Field(() => ID)
    id!: string

    /** The candidate. */
    @Field(() => ID)
    candidateId!: string

    /** The step title. */
    @Field(() => String)
    title!: string

    /** Whether it is done. */
    @Field(() => Boolean)
    done!: boolean

    /** When it was finished. */
    @Field(() => String, { nullable: true })
    doneAt!: string | null

    /** The display order. */
    @Field(() => Int)
    sort!: number
}
