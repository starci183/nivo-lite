import { Field, Int, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The ribbon figures of the workbench. */
export class ShiftsFiguresType {
    /** Shifts of this week's current schedule that have a person. */
    @Field(() => Int)
    weekFilled!: number

    /** Shifts of this week's current schedule in all. */
    @Field(() => Int)
    weekTotal!: number

    /** Whether the week has a schedule at all. */
    @Field(() => Boolean)
    weekHasSchedule!: boolean

    /** Published shifts in the next two weeks nobody has. */
    @Field(() => Int)
    openGaps!: number

    /** Leave requests waiting for the manager. */
    @Field(() => Int)
    leavePending!: number

    /** Scheduled hours of this month. */
    @Field(() => Float)
    hoursMonth!: number
}
