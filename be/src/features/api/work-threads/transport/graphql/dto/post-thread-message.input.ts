import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from "class-validator"
import { ThreadMentionRefInput } from "./thread-mention-ref.input"

@InputType()
/** What a member writes in a thread, with the tags chosen in the composer and the customer words quoted as data. */
export class PostThreadMessageInput {
    /** The thread to write in. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    threadId!: string

    /** What is written, 1 to 4000 characters. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    body!: string

    /** The tags the author chose; they are never read out of the text. */
    @Field(() => [ThreadMentionRefInput], { defaultValue: [] })
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => ThreadMentionRefInput)
    mentions: Array<ThreadMentionRefInput> = []

    /** Customer words to quote; they stay data and never become a tag. */
    @Field(() => [String], { defaultValue: [] })
    @IsArray()
    @ArrayMaxSize(10)
    @IsString({ each: true })
    @MaxLength(2500, { each: true })
    quoted: Array<string> = []
}
