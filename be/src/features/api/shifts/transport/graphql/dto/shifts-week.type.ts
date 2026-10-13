import { Field, ObjectType } from "@nestjs/graphql"
import { ShiftsScheduleVersionType } from "./shifts-schedule-version.type"
import { ShiftsScheduleType } from "./shifts-schedule.type"
import { ShiftType } from "./shift.type"
import { ShiftsWorkItemType } from "./shifts-work-item.type"
import { ShiftsCheckinType } from "./shifts-checkin.type"
import { ShiftsAvailType } from "./shifts-avail.type"
import { ShiftLeaveType } from "./shift-leave.type"
import { ShiftsPriorType } from "./shifts-prior.type"

@ObjectType()
/** One week of the workbench. */
export class ShiftsWeekType {
    /** The Monday shown. */
    @Field(() => String)
    monday!: string

    /** Every version of the week, newest first. */
    @Field(() => [ShiftsScheduleVersionType])
    versions!: ReadonlyArray<ShiftsScheduleVersionType>

    /** The version people work with; staff see only a published one, without summary and evidence. */
    @Field(() => ShiftsScheduleType, { nullable: true })
    current!: ShiftsScheduleType | null

    /** The shifts of the current version. */
    @Field(() => [ShiftType])
    shifts!: ReadonlyArray<ShiftType>

    /** The publish decision of the current version. */
    @Field(() => ShiftsWorkItemType, { nullable: true })
    publishItem!: ShiftsWorkItemType | null

    /** The check-ins of the shifts (managers only). */
    @Field(() => [ShiftsCheckinType])
    checkins!: ReadonlyArray<ShiftsCheckinType>

    /** Approved availability of everyone. */
    @Field(() => [ShiftsAvailType])
    approvedAvail!: ReadonlyArray<ShiftsAvailType>

    /** Approved leave of everyone. */
    @Field(() => [ShiftLeaveType])
    approvedLeaves!: ReadonlyArray<ShiftLeaveType>

    /** The work of the day before the week. */
    @Field(() => [ShiftsPriorType])
    prior!: ReadonlyArray<ShiftsPriorType>
}
