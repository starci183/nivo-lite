import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsIn, IsUUID, MaxLength } from "class-validator"
import type { Locale } from "@modules/platform/i18n"

@InputType()
/** Takes over a customer conversation or releases it to the AI. */
export class SetChatHandlingInput {
    /** The conversation id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    conversationId!: string

    /** The take over. */
    @Field()
    @IsBoolean()
    takeOver!: boolean

    /** The language of audit lines, Vietnamese by default. */
    @Field({ defaultValue: "vi" })
    @IsIn(["vi", "en"])
    locale: Locale = "vi"
}
