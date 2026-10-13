import { Field, Int, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsInt, Min, ValidateNested } from "class-validator"
import { OpeningHoursInput } from "./opening-hours.input"

@InputType()
/** The bounded arguments that save the notice, reminder and overtime rules. */
export class SaveShiftsSettingsInput {
    /** Hours of notice a swap needs. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    swapNoticeHours!: number

    /** Days of notice a leave needs. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    leaveNoticeDays!: number

    /** Minutes before a shift the reminder goes out. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    remindMinutes!: number

    /** Minutes after the start a no-show is reported. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    noshowMinutes!: number

    /** Hours per week after which work is paid at +50%. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    overtimeHoursWeek!: number

    /** The opening hours by weekday; a day absent is closed. */
    @Field(() => [OpeningHoursInput])
    @IsArray()
    @ArrayMaxSize(7)
    @ValidateNested({ each: true })
    @Type(() => OpeningHoursInput)
    openingHours!: Array<OpeningHoursInput>
}
