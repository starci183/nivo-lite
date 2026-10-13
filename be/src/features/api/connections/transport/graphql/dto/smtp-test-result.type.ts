import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a test email to an SMTP connection answered. */
export class SmtpTestResultType {
    /** The address the test went to. */
    @Field(() => String)
    to!: string

    /** Whether the connection is now the workspace default sender. */
    @Field(() => Boolean)
    isDefault!: boolean
}
