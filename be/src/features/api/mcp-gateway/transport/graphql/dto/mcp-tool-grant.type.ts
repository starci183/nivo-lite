import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One agent's grant of a gateway tool. */
export class McpToolGrantType {
    /** The agent. */
    @Field(() => String)
    agentId!: string

    /** The agent's name. */
    @Field(() => String)
    agentName!: string

    /** The full tool name or connector.*. */
    @Field(() => String)
    tool!: string

    /** auto, ask or never. */
    @Field(() => String)
    mode!: string

    /** The amount limit, or null. */
    @Field(() => Float, { nullable: true })
    limitVnd!: number | null

    /** The argument constraints as JSON: [{ "arg": "discountPct", "max": 5 }]. */
    @Field(() => String)
    constraintsJson!: string
}
