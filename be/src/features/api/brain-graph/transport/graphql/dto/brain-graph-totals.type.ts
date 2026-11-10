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
}
