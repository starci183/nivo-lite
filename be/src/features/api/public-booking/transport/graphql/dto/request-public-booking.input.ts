import { Field, InputType, Int } from "@nestjs/graphql"
import { IsISO8601, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded booking request of an anonymous visitor. */
export class RequestPublicBookingInput {
    /** The published booking page slug. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{2,40}$/)
    @MaxLength(41)
    slug!: string

    /** The offered service id. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    serviceId!: string

    /** The requested start as ISO 8601. */
    @Field()
    @IsISO8601({ strict: true })
    @MaxLength(40)
    start!: string

    /** The visitor name. */
    @Field()
    @IsString()
    @MaxLength(120)
    name!: string

    /** The visitor phone. */
    @Field()
    @IsString()
    @MaxLength(40)
    phone!: string

    /** The optional visitor email. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    email?: string

    /** The number of visitors. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(20)
    party!: number

    /** The optional booking note. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(400)
    note?: string

    /** The idempotency token of this request. */
    @Field()
    @IsString()
    @MaxLength(64)
    token!: string

    /** The hidden spam trap. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    website?: string
}
