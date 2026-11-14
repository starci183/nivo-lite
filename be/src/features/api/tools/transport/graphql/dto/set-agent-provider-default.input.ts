import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Makes an agent's attachment to a connected account its default account of that account's provider. */
export class SetAgentProviderDefaultInput {
    /** The agent. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** The connected account: the connection id the agent is attached to. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    connectionId!: string
}
