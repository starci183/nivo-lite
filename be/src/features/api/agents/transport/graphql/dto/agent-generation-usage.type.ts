import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a run cost. */
export class AgentGenerationUsageType {
    /** Prompt tokens, cached ones included. */
    @Field(() => Int)
    prompt_tokens!: number

    /** Completion tokens. */
    @Field(() => Int)
    completion_tokens!: number

    /** Prompt tokens served from the cache. */
    @Field(() => Int)
    cached_tokens!: number

    /** The provider cost of the run. */
    @Field(() => Float)
    cost!: number

    /** Who served the run, `provider/model`. */
    @Field(() => String, { nullable: true })
    model?: string | null
}
