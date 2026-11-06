import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Mutes or unmutes a room for the viewer. */
export class SetChatRoomMutedInput {
    /** The room. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    roomId!: string

    /** True to mute. */
    @Field(() => Boolean)
    @IsBoolean()
    muted!: boolean
}
