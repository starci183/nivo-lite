import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What asking for a text without waiting answered: the id to poll, or the reason it was not queued. */
export class AgentGenerationRequestedType {
    /** True when the text was queued. */
    @Field()
    ok!: boolean

    /** The queued text; present on success. */
    @Field(() => ID, { nullable: true })
    generationId?: string | null

    /** `quota`, `engine_offline`, `timeout`, `error` or `not_configured`; present on failure. */
    @Field(() => String, { nullable: true })
    reason?: string | null

    /** The sentence to show, in the request language; present on failure. */
    @Field(() => String, { nullable: true })
    message?: string | null
}
