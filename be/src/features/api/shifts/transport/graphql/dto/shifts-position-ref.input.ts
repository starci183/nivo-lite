import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one position of the caller's workspace. */
export class ShiftsPositionRefInput {
    /** The position. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
