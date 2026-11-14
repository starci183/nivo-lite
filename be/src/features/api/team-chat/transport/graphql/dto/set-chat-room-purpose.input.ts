import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { ChatGroupPurpose } from "./chat-group-purpose.type"

@InputType()
/** Gives a group its purpose. */
export class SetChatRoomPurposeInput {
    /** The group. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    roomId!: string

    /** Plain, the common room, or the room of one module's team. */
    @Field(() => ChatGroupPurpose)
    @IsIn(["group", "common", "module"])
    @MaxLength(6)
    purpose!: string

    /** The module whose team room it is, for the purpose module. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    purposeModule: string | null = null
}
