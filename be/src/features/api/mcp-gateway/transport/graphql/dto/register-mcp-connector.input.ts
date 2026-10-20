import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** A remote MCP server to put behind the gateway; the credential is a NAME the api reads through <NAME>_FILE. */
export class RegisterMcpConnectorInput {
    /** The namespace key. */
    @Field(() => String)
    @Matches(/^[a-z][a-z0-9-]{1,30}$/u)
    key!: string

    /** The display name. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    name!: string

    /** The Streamable HTTP endpoint. */
    @Field(() => String)
    @IsUrl({ require_tld: false, require_protocol: true })
    url!: string

    /** The credential NAME, or null. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @Matches(/^[A-Z][A-Z0-9_]{2,80}$/u)
    credentialRef?: string | null

    /** The contract version. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    contractVersion!: string

    /** The per-call limit, or null for the default (4 s). */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(500)
    @Max(15000)
    timeoutMs?: number | null
}
