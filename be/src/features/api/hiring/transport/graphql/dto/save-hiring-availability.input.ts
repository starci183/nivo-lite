import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { HiringAvailabilityWindowInput } from "./hiring-availability-window.input"

@InputType()
/** The bounded arguments that replace the weekly free times of a member. */
export class SaveHiringAvailabilityInput {
    /** The member. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    memberUserId!: string

    /** The free windows. */
    @Field(() => [[HiringAvailabilityWindowInput]])
    @IsArray()
    @ArrayMaxSize(49)
    @ValidateNested({ each: true })
    @Type(() => HiringAvailabilityWindowInput)
    windows!: Array<HiringAvailabilityWindowInput>
}
