import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that give a draft shift to another person or open it. */
export class ReassignShiftsShiftInput {
    /** The shift. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    shiftId!: string

    /** The person, or null to open the shift. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    staffId?: string
}
