import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for the settle-won-deal mutation. */
export class SettleWonDealInput {
    /** The lead to process in the selected workspace. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    leadId!: string

    /** Evidence to include in the won-deal handoff. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    evidence?: string | null
}
