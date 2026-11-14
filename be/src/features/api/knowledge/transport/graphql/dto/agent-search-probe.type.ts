import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What one Brain read tool answered when run as an agent. */
export class AgentSearchProbeType {
    /** The tool that ran. */
    @Field(() => String)
    tool!: string

    /** True when the tool answered; false when it refused an expected case. */
    @Field(() => Boolean)
    ok!: boolean

    /** The tool's own answer, as the JSON text the model would read; null when it refused. */
    @Field(() => String, { nullable: true })
    answer?: string | null

    /** The typed reason of an expected refusal, or null. */
    @Field(() => String, { nullable: true })
    refusal?: string | null

    /** How long the tool took, milliseconds. */
    @Field(() => Int)
    ms!: number
}
