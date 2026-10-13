import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that hand a shift over or take an open one. */
export class RequestShiftsSwapInput {
    /** swap: hand the shift to another person; claim: take an open shift. */
    @Field(() => String)
    @IsIn(["swap", "claim"])
    kind!: "swap" | "claim"

    /** The shift. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    shiftId!: string

    /** The person who takes the shift; for a claim it is the member who asks. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    toStaffId?: string

    /** The reason typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    reason!: string
}
