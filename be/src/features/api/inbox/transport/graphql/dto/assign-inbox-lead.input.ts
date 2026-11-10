import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Hands one customer to an agent, or to nobody. */
export class AssignInboxLeadInput {
    /** The lead. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    leadId!: string

    /** The agent, or nothing to take the customer back. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    agentId: string | null = null
}
