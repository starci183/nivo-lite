import { Field, ID, ObjectType } from "@nestjs/graphql"
import { AgentGenerationUsageType } from "./agent-generation-usage.type"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@ObjectType()
/** Where a queued text stands. */
export class AgentGenerationStatusType {
    /** The queued text. */
    @Field(() => ID)
    generationId!: string

    /** `queued`, `running`, `done` or `failed`. */
    @Field()
    status!: string

    /** The generated text; present when done. */
    @Field(() => String, { nullable: true })
    output?: string | null

    /** What the run cost; null when the gateway reported none. */
    @Field(() => AgentGenerationUsageType, { nullable: true })
    usage?: AgentGenerationUsageType | null

    /** Milliseconds from the start of the run to each named mark. */
    @Field(() => GraphqlJsonObject)
    timings!: object
}
