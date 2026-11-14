import { Field, ID, ObjectType } from "@nestjs/graphql"
import type { ApiKeyInactiveReason as ApiKeyInactiveReasonValue, ApiKeyKind as ApiKeyKindValue } from "@modules/domain/api-keys"
import { ApiKeyInactiveReason } from "./api-key-inactive-reason.type"
import { ApiKeyKind } from "./api-key-kind.type"

@ObjectType()
/** One workspace API key as an owner or manager sees it: never the secret. */
export class ApiKeyType {
    /** The key id. */
    @Field(() => ID)
    id!: string

    /** The name the holder gave the key. */
    @Field()
    name!: string

    /** The first characters of the key, enough to recognise it. */
    @Field()
    prefix!: string

    /** What the key is for. */
    @Field(() => ApiKeyKind)
    kind!: ApiKeyKindValue

    /** The account of the member the key runs as (its creator), or null when that account was deleted. */
    @Field(() => String, { nullable: true })
    holderId!: string | null

    /** The seat name of the holder, or null when the holder is no active member any more. */
    @Field(() => String, { nullable: true })
    holderName!: string | null

    /** When the key was created, ISO 8601. */
    @Field()
    createdAt!: string

    /** When the key last authenticated a request, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    lastUsedAt!: string | null

    /** When the key was revoked, ISO 8601, or null while it works. */
    @Field(() => String, { nullable: true })
    revokedAt!: string | null

    /** Why the key is suspended now (an MCP key whose holder is no longer an owner or manager), or null while it works or once revoked. */
    @Field(() => ApiKeyInactiveReason, { nullable: true })
    inactiveReason!: ApiKeyInactiveReasonValue | null

    /** The agent the key is scoped to (an MCP key: it sees only that agent and its workflows; a public API key: it owns the conversations the key opens), or null. */
    @Field(() => String, { nullable: true })
    agentId!: string | null

    /** The MCP endpoint an MCP key is used at, or null for a public API key or when the deployment publishes no MCP route. */
    @Field(() => String, { nullable: true })
    endpointUrl!: string | null
}
