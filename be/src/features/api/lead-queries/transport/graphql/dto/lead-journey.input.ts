import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Identifies the customer's journey in the selected workspace. */
export class LeadJourneyInput {
    /** The lead whose journey is read. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    leadId!: string
}
