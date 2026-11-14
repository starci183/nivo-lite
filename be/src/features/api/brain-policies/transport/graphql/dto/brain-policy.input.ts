import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Which row's drawer to read. */
export class BrainPolicyInput {
    /** The row (`BrainPolicyRow.factId`). */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    factId!: string
}

@InputType()
/** The owner's edit of one row ("Save"). */
export class SetBrainPolicyInput {
    /** The row (`BrainPolicyRow.factId`). */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    factId!: string

    /**
     * The new value as typed; it must read as the row's `type`. Digits alone mean VND (money), percent (percent) or minutes (duration);
     * Vietnamese forms are read too (for example "35.000 d", "35k", "10%", "8:00-20:00"). Absent = keep the value.
     */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    value?: string

    /** "From date" (ISO); absent or past = "Right now". */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsISO8601()
    @MaxLength(40)
    validFrom?: string

    /** Until when (ISO); absent = one year. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsISO8601()
    @MaxLength(40)
    validTo?: string

    /** The "customer may know" switch: `public` (on) or `internal` (off); absent = keep. Owner only. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsIn(["public", "internal"])
    @MaxLength(10)
    audience?: "public" | "internal"
}

@InputType()
/** Takes a policy out of force. */
export class UnsetBrainPolicyInput {
    /** The row (`BrainPolicyRow.factId`). */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    factId!: string

    /** Why. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string
}
