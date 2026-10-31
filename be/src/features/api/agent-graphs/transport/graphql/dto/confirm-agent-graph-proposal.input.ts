import { Field, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What confirmAgentGraphProposal takes. */
export class ConfirmAgentGraphProposalInput {
    /** The agent. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** The proposal. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    proposalId!: string
}
