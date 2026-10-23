import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One tool of a gateway connector. */
export class McpToolType {
    /** True when the tool may run: native, or a remote tool whose live schema is the approved one. */
    @Field(() => Boolean)
    approved!: boolean

    /** The full namespaced name, for example shop.order.place. */
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

    /** none (the server takes no credential), needed (not entered yet) or set; the value is never read back. */
    @Field(() => String)
    credentialState!: string

    /** When the credential was last set or rotated, ISO text, or null. */
    @Field(() => String, { nullable: true })
    credentialSetAt!: string | null

    /** The contract version. */
    @Field(() => String)
    contractVersion!: string

    /** The per-call time limit. */
    @Field(() => Int)
    timeoutMs!: number

    /** When its tool catalog was approved, ISO text, or null. */
    @Field(() => String, { nullable: true })
    approvedAt!: string | null

    /** When it was last checked (a health check or a catalog read), ISO text, or null. */
    @Field(() => String, { nullable: true })
    checkedAt!: string | null

    /** The tools. */
    @Field(() => [McpToolType])
    tools!: Array<McpToolType>
}
