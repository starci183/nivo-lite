import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import type { ApiKeyKind as ApiKeyKindValue } from "@modules/domain/api-keys"
import { ApiKeyKind } from "./api-key-kind.type"

@InputType()
/** The bounded arguments that create an API key. */
export class CreateApiKeyInput {
    /** The name of the key (trimmed to 60 characters, at least 2). */
    @Field()
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    name!: string

    /** What the key is for; omitted for a public API key. */
    @Field(() => ApiKeyKind, { nullable: true })
    @IsOptional()
    @IsIn(Object.values(ApiKeyKind))
    kind?: ApiKeyKindValue

    /** The agent of the workspace the key is scoped to (an MCP key: it sees only that agent and its workflows; a public API key: it owns the conversations the key opens); omitted for an unscoped key. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    agentId?: string
}
