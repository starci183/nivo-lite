import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The figures of the strip above the list; the dashboard reads the same ones. */
export class InboxFiguresType {
    /** Customers with an input in the last seven days. */
    @Field(() => Int)
    visitors7d!: number

    /** Customers whose first input came in the last day. */
    @Field(() => Int)
    newToday!: number

    /** Customers something waits on the owner for. */
    @Field(() => Int)
    needsYou!: number

    /** The share of the work of the week that the agents did alone, 0 to 100; null when there was no work. */
    @Field(() => Int, { nullable: true })
    autoReplyPct!: number | null

    /** The mean seconds from an input to the agent finishing it over the week; null when none finished. */
    @Field(() => Int, { nullable: true })
    avgResponseSeconds!: number | null
}
