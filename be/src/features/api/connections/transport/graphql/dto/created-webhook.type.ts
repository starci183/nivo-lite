import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A webhook connection just created: the signing secret is in this answer only. */
export class CreatedWebhookType {
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

    /** The signing secret to copy into the receiver, shown once. */
    @Field(() => String)
    signingSecret!: string
}
