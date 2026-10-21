import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The remote connector whose catalog is read again. */
export class SyncMcpConnectorInput {
    /** The connector key. */
    @Field(() => String)
    @IsString()
    @MaxLength(31)
    @Matches(/^[a-z][a-z0-9-]{1,30}$/u)
    key!: string
}
