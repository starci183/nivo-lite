import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The wizard view of an outgoing email (SMTP) connection. */
export class SmtpConnectionType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The mail server. */
    @Field(() => String)
    host!: string

    /** The sender mailbox. */
    @Field(() => String)
    fromEmail!: string

    /** Whether it is the workspace default sender. */
    @Field(() => Boolean)
    isDefault!: boolean
}
