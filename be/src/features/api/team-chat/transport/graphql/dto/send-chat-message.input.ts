import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { ChatMemberRefInput } from "./chat-member-ref.input"

@InputType()
/** A text message. It is always written as text: reports and approval cards are the engine's. */
export class SendChatMessageInput {
    /** The room; omit it for the first message to a member (then `to` is required). */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("all")
    @MaxLength(36)
    roomId: string | null = null

    /** The member the first message goes to; the direct room with them is opened when it does not exist. */
    @Field(() => ChatMemberRefInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => ChatMemberRefInput)
    to: ChatMemberRefInput | null = null

    /** The text; empty only with files. The service refuses one over the limit with `body_too_long`. */
    @Field(() => String)
    @IsString()
    @MaxLength(16000)
    body!: string

    /** The members it mentions. */
    @Field(() => [ChatMemberRefInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(40)
    @ValidateNested({ each: true })
    @Type(() => ChatMemberRefInput)
    mentions: Array<ChatMemberRefInput> | null = null

    /** The files it carries, by key. */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(300, { each: true })
    fileKeys: Array<string> | null = null

    /** The retry key: the same one from the same author in the same room is the same message. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    clientId: string | null = null
}
