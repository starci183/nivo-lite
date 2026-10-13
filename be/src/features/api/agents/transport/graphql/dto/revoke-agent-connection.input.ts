import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Removes the grant of a connection to an agent. */
export class RevokeAgentConnectionInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string

    /** The connection. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    connectionId!: string
}
