import { Field, InputType, ID } from "@nestjs/graphql"
import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator"

@InputType()
/** The bounded update loyalty member arguments. */
export class UpdateLoyaltyMemberInput {
    /** The customer id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    customerId!: string

    /** The name. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    name?: string | null

    /** The birthday. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsDateString({ strict: true })
    @Matches(/^\d{4}-\d{2}-\d{2}$/u)
    @MaxLength(10)
    birthday?: string | null

    /** The note. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string | null
}
