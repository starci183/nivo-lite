import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of submitTelegramCode. */
export class SubmitTelegramCodeInput {
    /** The pending Telegram connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The code from Telegram. */
    @Field(() => String)
    @IsString()
    @MaxLength(32)
    code!: string
}
