import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One weekly availability window of a member. */
export class HiringWindowType {
    /** The weekday, 0 (Sunday) to 6. */
    @Field(() => Int)
    weekday!: number

    /** Minutes from midnight, Vietnam time. */
    @Field(() => Int)
    startMin!: number

    /** Minutes from midnight, Vietnam time. */
    @Field(() => Int)
    endMin!: number
}
