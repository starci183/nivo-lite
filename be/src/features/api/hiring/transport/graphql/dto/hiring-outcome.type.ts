import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a hiring request that goes through a decision answers. */
export class HiringOutcomeType {
    /** The status of the decision. */
    @Field(() => String)
    status!: string

    /** One line saying what happened. */
    @Field(() => String)
    summary!: string

    /** Why it failed. */
    @Field(() => String, { nullable: true })
    error!: string | null
}
