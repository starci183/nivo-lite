import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** One Sales action completed by policy with its evidence. */
export class SalesActivityType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The action. */
    @Field(() => String)
    action!: string

    /** The lead id. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The customer. */
    @Field(() => String, { nullable: true })
    customer!: string | null

    /** The summary. */
    @Field(() => String)
    summary!: string

    /** The at. */
    @Field(() => String)
    at!: string

    /** The evidence state. */
    @Field(() => String)
    evidenceState!: string

    /** The evidence. */
    @Field(() => String, { nullable: true })
    evidence!: string | null

    /** The href. */
    @Field(() => String)
    href!: string
}
