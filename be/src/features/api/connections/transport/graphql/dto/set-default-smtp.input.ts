import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of setDefaultSmtp. */
export class SetDefaultSmtpInput {
    /** The SMTP connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string
}
