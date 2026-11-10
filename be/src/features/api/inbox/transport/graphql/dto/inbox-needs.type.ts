import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What the customer needs: the summary and the facts the agent extracted. */
export class InboxNeedsType {
    /** The summary of what they want. */
    @Field(() => String, { nullable: true })
    summary!: string | null

    /** What they want to buy. */
    @Field(() => String, { nullable: true })
    items!: string | null

    /** The value in VND. */
    @Field(() => Float, { nullable: true })
    valueVnd!: number | null

    /** When and where it should arrive. */
    @Field(() => String, { nullable: true })
    delivery!: string | null

    /** A note about the order. */
    @Field(() => String, { nullable: true })
    note!: string | null
}
