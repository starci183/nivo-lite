import { Field, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What declineAgentGraphProposal takes. */
export class DeclineAgentGraphProposalInput {
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
