import { Field, InputType, Int } from "@nestjs/graphql"
import { IsBoolean, IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** Bounded arguments for save booking policy. */
export class SaveBookingPolicyInput {
    /** The cancel window hours. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(720)
    cancelWindowHours!: number

    /** The deposit pct. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(100)
    depositPct!: number

    /** The late cancel fee pct. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(100)
    lateCancelFeePct!: number

    /** The no show fee vnd. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(1000000000)
    noShowFeeVnd!: number

    /** The min lead min. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(100000)
    minLeadMin!: number

    /** The max advance days. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(365)
    maxAdvanceDays!: number

    /** The slot step min. */
    @Field(() => Int)
    @IsInt()
    @Min(5)
    @Max(240)
    slotStepMin!: number

    /** The auto confirm. */
    @Field(() => Boolean)
    @IsBoolean()
    autoConfirm!: boolean

    /** The handoff order. */
    @Field(() => Boolean)
    @IsBoolean()
    handoffOrder!: boolean

    /** The address. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    address!: string

    /** The timezone. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    timezone!: string
}
