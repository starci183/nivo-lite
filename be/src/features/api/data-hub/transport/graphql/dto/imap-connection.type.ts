import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A saved mailbox, without its password. */
export class ImapConnectionType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The connection name. */
    @Field(() => String)
    name!: string

    /** The mailbox address. */
    @Field(() => String)
    email!: string

    /** The IMAP server. */
    @Field(() => String)
    host!: string

    /** The IMAP port. */
    @Field(() => Int)
    port!: number

    /** The security: tls or starttls. */
    @Field(() => String)
    security!: string

    /** The login name. */
    @Field(() => String)
    user!: string

    /** The folders read. */
    @Field(() => [String])
    folders!: Array<string>

    /** How many days back a first read goes. */
    @Field(() => Int)
    sinceDays!: number

    /** Minutes between scheduled syncs; null is manual only. */
    @Field(() => Int, { nullable: true })
    syncEveryMinutes!: number | null

    /** Agents that hold a grant on this mailbox. */
    @Field(() => [ID])
    agentIds!: Array<string>
}
