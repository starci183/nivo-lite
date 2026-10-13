import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ShiftsMyShiftType } from "./shifts-my-shift.type"
import { ShiftType } from "./shift.type"
import { ShiftsColleagueType } from "./shifts-colleague.type"
import { ShiftsAvailabilityType } from "./shifts-availability.type"
import { ShiftsLeaveType } from "./shifts-leave.type"
import { ShiftsSwapType } from "./shifts-swap.type"

@ObjectType()
/** The signed-in person's own schedule view. */
export class ShiftsMineType {
    /** The caller's own shifts profile, when linked. */
    @Field(() => ID, { nullable: true })
    profileId!: string | null

    /** Today, Vietnam calendar. */
    @Field(() => String)
    today!: string

    /** Their shifts of the next two weeks. */
    @Field(() => [[ShiftsMyShiftType]])
    myShifts!: ReadonlyArray<ShiftsMyShiftType>

    /** Open shifts they may ask for. */
    @Field(() => [[ShiftType]])
    openShifts!: ReadonlyArray<ShiftType>

    /** The colleagues they may swap with. */
    @Field(() => [[ShiftsColleagueType]])
    colleagues!: ReadonlyArray<ShiftsColleagueType>

    /** Their availability statements. */
    @Field(() => [[ShiftsAvailabilityType]])
    availability!: ReadonlyArray<ShiftsAvailabilityType>

    /** Their leave requests. */
    @Field(() => [[ShiftsLeaveType]])
    leaves!: ReadonlyArray<ShiftsLeaveType>

    /** Their swap and claim requests. */
    @Field(() => [[ShiftsSwapType]])
    swaps!: ReadonlyArray<ShiftsSwapType>
}
