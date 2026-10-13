import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import type { Locale } from "@modules/platform/i18n"

@InputType()
/** Stores a member reply and queues its delivery. */
export class RequestChatReplyInput {
    /** The conversation id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    conversationId!: string

    /** The body. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    body!: string

    /** The language of audit lines, Vietnamese by default. */
    @Field({ defaultValue: "vi" })
    @IsIn(["vi", "en"])
    locale: Locale = "vi"
}
