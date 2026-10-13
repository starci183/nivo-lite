import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one pending invitation. */
export class InviteRefInput {
    /** The invitation. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    inviteId!: string
}
