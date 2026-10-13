import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one shift of the caller's workspace. */
export class ShiftsShiftRefInput {
    /** The shift. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    shiftId!: string
}
