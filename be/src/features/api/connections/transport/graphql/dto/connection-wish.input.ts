import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** One connection wanted for an agent. */
export class ConnectionWishInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** Ignored: a binding has no level any more (rights live in the agent's attachments). Removed next release. */
    @Field(() => String, { nullable: true, description: "Ignored: a binding has no level any more (rights live in the agent's attachments). Removed next release." })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(8)
    @IsIn(["read", "ask", "auto"])
    access?: string
}
