import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Detaches an agent from a provider. */
export class DetachAgentProviderInput {
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
