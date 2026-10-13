import { Field, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for the suggest-lead-owner mutation. */
export class SuggestLeadOwnerInput {
    /** The lead to process in the selected workspace. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    leadId!: string
}
