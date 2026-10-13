import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one coverage block of the caller's workspace. */
export class ShiftsCoverageRefInput {
    /** The block. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
