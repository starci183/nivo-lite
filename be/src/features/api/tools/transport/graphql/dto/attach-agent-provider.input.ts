import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Attaches an agent to a connected account. */
export class AttachAgentProviderInput {
    /** The agent. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** The connected account: the connection id. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    connectionId!: string
}
