import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one availability statement of the caller's workspace. */
export class ShiftsAvailabilityRefInput {
    /** The statement. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
