import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Publishes only the caller's typing hint; identities are always server-authored. */
export class SetChatTypingInput {
    /** The team-chat room. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    roomId!: string

    /** Refresh while typing and send false on stop; receivers also enforce expiresAt. */
    @Field()
    @IsBoolean()
    typing!: boolean
}
