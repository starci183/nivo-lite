import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator"
import { ChatGroupPurpose } from "./chat-group-purpose.type"
import { ChatMemberRefInput } from "./chat-member-ref.input"
import { ChatRoomKind } from "./chat-room-kind.type"

@InputType()
/** Opens a direct room (one other member, no name) or a group (a name, any members). */
export class CreateChatRoomInput {
    /** Direct or group. */
    @Field(() => ChatRoomKind)
    @IsIn(["direct", "group"])
    @MaxLength(10)
    kind!: string

    /** The name of a group, one to eighty characters; null for a direct room. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name: string | null = null

    /** The other members; the creator joins as owner. */
    @Field(() => [ChatMemberRefInput])
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => ChatMemberRefInput)
    members!: Array<ChatMemberRefInput>

    /** What a group is for; a plain group when omitted. A direct room takes none. */
    @Field(() => ChatGroupPurpose, { nullable: true })
    @IsOptional()
    @IsIn(["group", "common", "module"])
    purpose: string | null = null

    /** The module whose team room it is, for the purpose module. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    purposeModule: string | null = null
}
