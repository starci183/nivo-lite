import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Which customer to read: a lead, or the customer of a run. */
export class LeadFreezeInput {
    /** The lead. */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    leadId?: string

    /** The run. */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    runId?: string
}

@InputType()
/** The owner's answer to a frozen customer. */
export class DecideLeadFreezeInput {
    /** The freeze. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    freezeId!: string

    /** `retry`, `take_over` or `skip`. */
    @Field(() => String)
    @IsIn(["retry", "take_over", "skip"])
    @MaxLength(10)
    action!: string
}
