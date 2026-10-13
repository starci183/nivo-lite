import { Field, Int, ObjectType } from "@nestjs/graphql"
import { OpeningDayType } from "./opening-day.type"

@ObjectType()
/** The rules and hours of the shop. */
export class ShiftsSettingsType {
    /** The opening hours by weekday; a closed day is absent. */
    @Field(() => [[OpeningDayType]])
    openingHours!: ReadonlyArray<OpeningDayType>

    /** Hours of notice a swap needs before the shift. */
    @Field(() => Int)
    swapNoticeHours!: number

    /** Days of notice a leave request needs. */
    @Field(() => Int)
    leaveNoticeDays!: number

    /** Minutes before a shift the reminder goes out. */
    @Field(() => Int)
    remindMinutes!: number

    /** Minutes after a shift started the owner is told nobody checked in. */
    @Field(() => Int)
    noshowMinutes!: number

    /** Hours per week after which work is paid at +50%. */
    @Field(() => Int)
    overtimeHoursWeek!: number
}
