import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The wizard view of a webhook connection. */
export class WebhookViewType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The host of the receiver. */
    @Field(() => String)
    host!: string

    /** The events it receives. */
    @Field(() => [String])
    events!: ReadonlyArray<string>

    /** The signing secret to copy into the receiver. */
    @Field(() => String)
    signingSecret!: string
}
