import { Field, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The customer whose journey is read in the selected workspace. */
export class LeadFlowInput {
    /** The customer's UUID. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    leadId!: string
}
