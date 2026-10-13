import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments of connectTelegram. */
export class ConnectTelegramInput {
    /** The name the owner gives the connection. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The bot token from @BotFather. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    token!: string
}
