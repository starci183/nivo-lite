import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** One agent wanted on a connection. */
export class GrantWishInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    agentId!: string
}
