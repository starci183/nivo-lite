import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments that create an API key. */
export class CreateApiKeyInput {
    /** The name of the key (trimmed to 60 characters, at least 2). */
    @Field()
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    name!: string

    /** The agent of the workspace the key acts as on the MCP endpoint (only `tools:call`); omitted for a public API key. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    agentId?: string
}
