import { Field, ObjectType, Float } from "@nestjs/graphql"
import { BookingSettingsType } from "./booking-settings.type"
import { BookingBoardServiceType } from "./booking-board-service.type"
import { BookingBoardResourceType } from "./booking-board-resource.type"
import { BookingBoardHoursType } from "./booking-board-hours.type"
import { BookingBoardExceptionType } from "./booking-board-exception.type"
import { BookingBoardEntryType } from "./booking-board-entry.type"
import { BookingBoardWaitType } from "./booking-board-wait.type"
import { BookingBoardStaffType } from "./booking-board-staff.type"
import { BookingFiguresType } from "./booking-figures.type"
import { BookingStatsType } from "./booking-stats.type"

@ObjectType()
/** The booking board view. */
export class BookingBoardType {
    /** The timezone. */
    @Field(() => String)
    timezone!: string

    /** The today. */
    @Field(() => String)
    today!: string

    /** The now ms. */
    @Field(() => Float)
    nowMs!: number

    /** The from. */
    @Field(() => String)
    from!: string

    /** The to. */
    @Field(() => String)
    to!: string

    /** The settings. */
    @Field(() => BookingSettingsType)
    settings!: BookingSettingsType

    /** The services. */
    @Field(() => [BookingBoardServiceType])
    services!: ReadonlyArray<BookingBoardServiceType>

    /** The resources. */
    @Field(() => [BookingBoardResourceType])
    resources!: ReadonlyArray<BookingBoardResourceType>

    /** The hours. */
    @Field(() => [BookingBoardHoursType])
    hours!: ReadonlyArray<BookingBoardHoursType>

    /** The exceptions. */
    @Field(() => [BookingBoardExceptionType])
    exceptions!: ReadonlyArray<BookingBoardExceptionType>

    /** The bookings. */
    @Field(() => [BookingBoardEntryType])
    bookings!: ReadonlyArray<BookingBoardEntryType>

    /** The waitlist. */
    @Field(() => [BookingBoardWaitType])
    waitlist!: ReadonlyArray<BookingBoardWaitType>

    /** The staff. */
    @Field(() => [BookingBoardStaffType])
    staff!: ReadonlyArray<BookingBoardStaffType>

    /** The figures. */
    @Field(() => BookingFiguresType)
    figures!: BookingFiguresType

    /** The stats. */
    @Field(() => BookingStatsType)
    stats!: BookingStatsType
}
