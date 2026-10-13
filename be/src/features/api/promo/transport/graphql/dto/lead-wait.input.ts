import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The lead whose response delay should be read. */
export class LeadWaitInput {
    /** The workspace-scoped lead identifier. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    leadId!: string
}
