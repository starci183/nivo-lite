import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, Matches, MaxLength } from "class-validator"

@InputType()
/** Detaches an agent from a provider. */
export class DetachAgentProviderInput {
    /** The agent. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** The provider key. */
    @Field(() => String)
    @IsString()
    @MaxLength(31)
    @Matches(/^[a-z][a-z0-9_-]{1,30}$/u)
    provider!: string
}
