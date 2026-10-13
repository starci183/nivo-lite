import { Field, Float, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator"

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const STATUSES = ["active", "ended", "cancelled"] as const

@InputType()
/** A bounded recurring contract, with dates and an optional amount in whole dong. */
export class SaveContractInput {
    /** The contract to edit; omitted or null creates one. */
    @Field(() => ID, { nullable: true, defaultValue: null })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    contractId!: string | null

    /** The linked customer, when known. */
    @Field(() => ID, { nullable: true, defaultValue: null })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    leadId!: string | null

    /** The customer name. */
    @Field()
    @IsString()
    @MaxLength(200)
    customerName!: string

    /** The plan the customer buys. */
    @Field()
    @IsString()
    @MaxLength(200)
    plan!: string

    /** The first day, YYYY-MM-DD. */
    @Field()
    @IsISO8601({ strict: true })
    @Matches(DAY_PATTERN)
    @MaxLength(10)
    startsOn!: string

    /** The last day, YYYY-MM-DD. */
    @Field()
    @IsISO8601({ strict: true })
    @Matches(DAY_PATTERN)
    @MaxLength(10)
    endsOn!: string

    /** The amount in whole dong; omitted or null means it is not agreed. */
    @Field(() => Float, { nullable: true, defaultValue: null })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(Number.MAX_SAFE_INTEGER)
    amountVnd!: number | null

    /** `active`, `ended` or `cancelled`. */
    @Field()
    @IsIn(STATUSES)
    @MaxLength(20)
    status!: string

    /** A free note. */
    @Field()
    @IsString()
    @MaxLength(600)
    note!: string
}
