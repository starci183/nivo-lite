import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ShiftsSetupType } from "./shifts-setup.type"
import { ShiftsWeekType } from "./shifts-week.type"
import { ShiftsRequestsType } from "./shifts-requests.type"
import { ShiftsStaffRowType } from "./shifts-staff-row.type"
import { ShiftsAvailabilityType } from "./shifts-availability.type"
import { ShiftsFiguresType } from "./shifts-figures.type"

@ObjectType()
/** The whole shifts workbench. */
export class ShiftsBenchType {
    /** The caller's role. */
    @Field(() => String)
    role!: string

    /** Today, Vietnam calendar. */
    @Field(() => String)
    today!: string

    /** The setup of the shop; pay only for managers. */
    @Field(() => ShiftsSetupType)
    setup!: ShiftsSetupType

    /** The caller's own shifts profile, when linked. */
    @Field(() => ID, { nullable: true })
    myProfileId!: string | null

    /** Whether the shift reminder pipeline is on. */
    @Field(() => Boolean)
    reminderOn!: boolean

    /** The week shown. */
    @Field(() => ShiftsWeekType)
    week!: ShiftsWeekType

    /** The requests. */
    @Field(() => ShiftsRequestsType)
    requests!: ShiftsRequestsType

    /** Shop staff rows for the link choice; managers only. */
    @Field(() => [ShiftsStaffRowType])
    staffRows!: ReadonlyArray<ShiftsStaffRowType>

    /** Every availability statement; managers only. */
    @Field(() => [ShiftsAvailabilityType])
    allAvailability!: ReadonlyArray<ShiftsAvailabilityType>

    /** The ribbon figures; managers only. */
    @Field(() => ShiftsFiguresType, { nullable: true })
    figures!: ShiftsFiguresType | null
}
