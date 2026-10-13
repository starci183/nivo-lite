import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from "class-validator"
import type { Locale } from "@modules/platform/i18n"

@InputType()
/** Queues the decision of a waiting customer escalation. */
export class RequestChatAnswerInput {
    /** The work item id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workItemId!: string

    /** The conversation id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    conversationId!: string

    /** The text. */
    @Field(() => String, { nullable: true })
    @ValidateIf((_input: object, value: unknown) => value !== null)
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    text!: string | null

    /** The language of audit lines, Vietnamese by default. */
    @Field({ defaultValue: "vi" })
    @IsIn(["vi", "en"])
    locale: Locale = "vi"
}
