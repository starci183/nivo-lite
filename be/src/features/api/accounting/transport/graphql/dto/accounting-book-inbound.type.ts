import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Accounting Book Inbound returned by GraphQL. */
export class AccountingBookInboundType {
    /** channel. */
    @Field(() => String)
    channel!: string

    /** event Id. */
    @Field(() => String, { nullable: true })
    eventId!: string | null

    /** body. */
    @Field(() => String)
    body!: string

    /** sender Name. */
    @Field(() => String, { nullable: true })
    senderName!: string | null
}
