import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of changeSmtpPassword. */
export class ChangeSmtpPasswordInput {
    /** The SMTP connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The new password. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    password!: string
}
