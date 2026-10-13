import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a signed test delivery answered. */
export class WebhookTestResultType {
    /** True when the receiver answered 2xx. */
    @Field(() => Boolean)
    ok!: boolean

    /** The status the receiver answered. */
    @Field(() => Int, { nullable: true })
    status!: number | null

    /** Why the test failed. */
    @Field(() => String, { nullable: true })
    error!: string | null

    /** How long it took, in milliseconds. */
    @Field(() => Int)
    durationMs!: number
}
