import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Moves the viewer's read position of a room. */
export class MarkChatRoomReadInput {
    /** The room. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    roomId!: string

    /** Read up to this message; omit for the newest. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("all")
    @MaxLength(36)
    messageId: string | null = null
}
