import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of submitTelegramPassword. */
export class SubmitTelegramPasswordInput {
    /** The pending Telegram connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The two-step verification password; used once, never stored. */
    @Field(() => String)
    @IsString()
    @MaxLength(256)
    password!: string
}
