import { Field, InputType, ID } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { Type } from "class-transformer"
import { BookingHoursRowInput } from "./booking-hours-row.input"

@InputType()
/** Bounded arguments for save booking hours. */
export class SaveBookingHoursInput {
    /** The resource id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    resourceId!: string

    /** The rows. */
    @Field(() => [BookingHoursRowInput])
    @IsArray()
    @ArrayMaxSize(56)
    @ValidateNested({ each: true })
    @Type(() => BookingHoursRowInput)
    rows!: Array<BookingHoursRowInput>
}
