import { Field, Float, InputType } from "@nestjs/graphql"
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator"
import type { SimulationChannel, SimulationKind } from "@modules/domain/inbox-simulation"

@InputType()
/** The bounded simulator fields; event identity may be omitted for a fresh input. */
export class SimulateInboundInput {
    /** The simulated channel displayed in the form. */
    @Field(() => String)
    @IsIn(["zalo", "facebook", "email", "phone", "bank", "manual"])
    channel!: SimulationChannel

    /** The kind of department work to start. */
    @Field(() => String)
    @IsIn(["message", "order", "payment"])
    kind!: SimulationKind

    /** The customer's name. */
    @Field()
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    senderName!: string

    /** The optional phone or email. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(240)
    senderContact?: string | null

    /** The optional customer text. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    body?: string | null

    /** The amount in VND, when present. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(Number.MAX_SAFE_INTEGER)
    amountVnd?: number | null

    /** The optional bank or order reference. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(240)
    externalRef?: string | null

    /** The optional item description of an order. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    items?: string | null

    /** A stable channel event identity; sending it again is counted as a duplicate. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(160)
    eventId?: string | null
}
