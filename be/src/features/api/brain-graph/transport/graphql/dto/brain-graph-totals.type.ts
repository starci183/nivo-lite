import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Totals of the whole graph ("19 nut - 23 quan he - 1 nut vua doi"). */
export class BrainGraphTotalsType {
    /** Truths in force or scheduled. */
    @Field(() => Int)
    nodes!: number

    /** Edges among them. */
    @Field(() => Int)
    relations!: number

    /** Truths put in force in the last seven days. */
    @Field(() => Int)
    recentlyChanged!: number

    /** Change requests waiting (the badge of "De nghi sua"). */
    @Field(() => Int)
    pending!: number

    /** Truths in force or scheduled NOT in this read (the graph reads at most 2,000): 0 when the graph is whole. */
    @Field(() => Int, { defaultValue: 0 })
    nodesNotShown!: number

    /** Waiting change requests NOT in this read (at most 2,000 are listed): 0 when all are. */
    @Field(() => Int, { defaultValue: 0 })
    pendingNotShown!: number
}
