import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** A chat the owner ticked. */
export class TelegramPickedChatInput {
    /** The Telegram chat id. */
    @Field(() => String)
    @IsString()
    @Matches(/^-?\d{1,20}$/u)
    @MaxLength(24)
    id!: string

    /** The chat title. */
    @Field(() => String)
    @IsString()
    @MaxLength(120)
    title!: string

    /** user, group or channel. */
    @Field(() => String)
    @IsIn(["user", "group", "channel"])
    kind!: "user" | "group" | "channel"
}
