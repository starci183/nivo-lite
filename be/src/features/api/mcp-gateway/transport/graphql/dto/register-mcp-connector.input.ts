import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** A remote MCP server to put behind the gateway, with its bearer credential (entered once, sealed in the database, never read back). */
export class RegisterMcpConnectorInput {
    /** The namespace key. */
    @Field(() => String)
    @IsString()
    @MaxLength(31)
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
    @IsString()
    @MaxLength(2000)
    @IsUrl({ require_tld: false, require_protocol: true })
    url!: string

    /** The bearer credential, or null when the server takes none (an update without one keeps the stored credential). */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(4096)
    credential?: string | null

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
