import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The activity block of a workspace. */
export class AdminActivityType {
    /** The messages7d. */
    @Field(() => Int)
    messages7d!: number

    /** The last customer message at. */
    @Field(() => String, { nullable: true })
    lastCustomerMessageAt!: string | null

    /** The open decisions. */
    @Field(() => Int)
    openDecisions!: number
}
