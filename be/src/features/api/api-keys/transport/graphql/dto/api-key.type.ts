import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One workspace API key as a manager sees it: never the secret. */
export class ApiKeyType {
    /** The key id. */
    @Field(() => ID)
    id!: string

    /** The name the manager gave the key. */
    @Field()
    name!: string

    /** The first characters of the key, enough to recognise it. */
    @Field()
    prefix!: string

    /** When the key was created, ISO 8601. */
    @Field()
    createdAt!: string

    /** When the key last authenticated a request, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    lastUsedAt!: string | null

    /** When the key was revoked, ISO 8601, or null while it works. */
    @Field(() => String, { nullable: true })
    revokedAt!: string | null

    /** The agent the key acts as on the MCP endpoint, or null for a public API key. */
    @Field(() => String, { nullable: true })
    agentId!: string | null
}
