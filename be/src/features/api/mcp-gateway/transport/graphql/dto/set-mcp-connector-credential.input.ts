import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength, MinLength } from "class-validator"

@InputType()
/** The new bearer credential of a remote connector: entered once, sealed in the database, never read back. */
export class SetMcpConnectorCredentialInput {
    /** The connector key. */
    @Field(() => String)
    @IsString()
    @MaxLength(31)
    @Matches(/^[a-z][a-z0-9-]{1,30}$/u)
    key!: string

    /** The credential. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(4096)
    credential!: string
}
