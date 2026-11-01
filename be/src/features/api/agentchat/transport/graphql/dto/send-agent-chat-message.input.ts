import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsOptional, IsUUID, IsString, MaxLength, ValidateNested } from "class-validator"

@InputType()
/** The file uploaded for a message. */
export class SentAgentChatFileInput {
    /** The object path the upload address answered. */
    @Field()
    @IsString()
    @MaxLength(255)
    path!: string

    /** The name of the file. */
    @Field()
    @IsString()
    @MaxLength(255)
    name!: string
}

@InputType()
/** Bounded arguments for SendAgentChatMessage. */
export class SendAgentChatMessageInput {
    /** The conversationId argument. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    conversationId!: string

    /** The body argument. */
    @Field()
    @IsString()
    @MaxLength(4000)
    body!: string

    /** The file sent with the message. */
    @Field(() => SentAgentChatFileInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => SentAgentChatFileInput)
    file: SentAgentChatFileInput | null = null
}
