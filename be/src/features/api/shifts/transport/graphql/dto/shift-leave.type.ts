import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Approved leave of one person. */
export class ShiftLeaveType {
    /** The person. */
    @Field(() => ID)
    staffId!: string

    /** The first day of leave. */
    @Field(() => String)
    from!: string

    /** The last day of leave. */
    @Field(() => String)
    to!: string
}
