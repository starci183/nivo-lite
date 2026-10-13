import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of sendSmtpTest. */
export class SendSmtpTestInput {
    /** The SMTP connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The address to send the test to. */
    @Field(() => String)
    @IsString()
    @MaxLength(254)
    to!: string

    /** Whether to make it the default sender. */
    @Field(() => Boolean)
    @IsBoolean()
    makeDefault!: boolean
}
