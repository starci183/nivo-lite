import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** One Sales opportunity that needs a person. */
export class SalesAttentionType {
    /** The key. */
    @Field(() => String)
    key!: string

    /** The kind. */
    @Field(() => String)
    kind!: string

    /** The lead id. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The customer. */
    @Field(() => String)
    customer!: string

    /** The company. */
    @Field(() => String)
    company!: string

    /** The stage. */
    @Field(() => String, { nullable: true })
    stage!: string | null

    /** The need. */
    @Field(() => String)
    need!: string

    /** The since. */
    @Field(() => String)
    since!: string

    /** The owner. */
    @Field(() => String, { nullable: true })
    owner!: string | null

    /** The work item id. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** The decision id. */
    @Field(() => ID, { nullable: true })
    decisionId!: string | null

    /** The action. */
    @Field(() => String, { nullable: true })
    action!: string | null

    /** The missing. */
    @Field(() => [String])
    missing!: ReadonlyArray<string>

    /** The newest conversation of the customer. */
    @Field(() => ID, { nullable: true })
    conversationId!: string | null
}
