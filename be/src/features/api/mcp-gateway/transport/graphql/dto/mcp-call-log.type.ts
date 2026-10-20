import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One audited gateway call; arguments and results are masked. */
export class McpCallLogType {
    /** The id. */
    @Field(() => String)
    id!: string

    /** The full tool name. */
    @Field(() => String)
    tool!: string

    /** The agent's name. */
    @Field(() => String)
    agentName!: string

    /** ok, error, refused, approval, timeout or circuit_open. */
    @Field(() => String)
    outcome!: string

    /** The failure code, or null. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null

    /** The masked arguments as JSON. */
    @Field(() => String)
    argsMasked!: string

    /** The masked result summary. */
    @Field(() => String)
    resultSummary!: string

    /** How long it took. */
    @Field(() => Int)
    durationMs!: number

    /** Who approved it, or null. */
    @Field(() => String, { nullable: true })
    approvedBy!: string | null

    /** When, ISO. */
    @Field(() => String)
    at!: string
}
