import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One tool of a gateway connector. */
export class McpToolType {
    /** The full namespaced name, for example hakuen.booking.hold. */
    @Field(() => String)
    name!: string

    /** read, write or restricted. */
    @Field(() => String)
    scope!: string

    /** What it does. */
    @Field(() => String)
    description!: string
}

@ObjectType()
/** One connector of the workspace's MCP gateway. */
export class McpConnectorType {
    /** The namespace key. */
    @Field(() => String)
    key!: string

    /** The display name. */
    @Field(() => String)
    name!: string

    /** native or remote. */
    @Field(() => String)
    kind!: string

    /** active, disabled or degraded. */
    @Field(() => String)
    status!: string

    /** The remote endpoint, or null. */
    @Field(() => String, { nullable: true })
    url!: string | null

    /** The NAME of the credential secret (never its value), or null. */
    @Field(() => String, { nullable: true })
    credentialRef!: string | null

    /** The contract version. */
    @Field(() => String)
    contractVersion!: string

    /** The per-call time limit. */
    @Field(() => Int)
    timeoutMs!: number

    /** The tools. */
    @Field(() => [McpToolType])
    tools!: Array<McpToolType>
}
