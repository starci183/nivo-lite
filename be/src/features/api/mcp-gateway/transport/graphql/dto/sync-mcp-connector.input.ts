import { Field, InputType } from "@nestjs/graphql"
import { Matches } from "class-validator"

@InputType()
/** The remote connector whose catalog is read again. */
export class SyncMcpConnectorInput {
    /** The connector key. */
    @Field(() => String)
    @Matches(/^[a-z][a-z0-9-]{1,30}$/u)
    key!: string
}
