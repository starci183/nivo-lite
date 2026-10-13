import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded arguments of startSmtpConnection. */
export class StartSmtpConnectionInput {
    /** The provider choice of the wizard. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    preset!: string

    /** The mail server. */
    @Field(() => String)
    @IsString()
    @MaxLength(253)
    host!: string

    /** The mail port. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(65535)
    port!: number

    /** `tls` or `starttls`. */
    @Field(() => String)
    @IsString()
    @MaxLength(10)
    security!: string

    /** The login. */
    @Field(() => String)
    @IsString()
    @MaxLength(254)
    user!: string

    /** The password. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    password!: string

    /** The display name of the sender. */
    @Field(() => String)
    @IsString()
    @MaxLength(80)
    fromName!: string

    /** The sender mailbox. */
    @Field(() => String)
    @IsString()
    @MaxLength(254)
    fromEmail!: string

    /** The Reply-To mailbox, or empty. */
    @Field(() => String)
    @IsString()
    @MaxLength(254)
    replyTo!: string
}
