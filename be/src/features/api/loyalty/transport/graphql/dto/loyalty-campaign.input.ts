import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The campaign whose current status the browser polls. */
export class LoyaltyCampaignInput {
    /** Campaign id within the selected workspace. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
