import { Field, InputType } from "@nestjs/graphql"
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator"
import { Type } from "class-transformer"
import { LoyaltyConfigInput } from "./loyalty-config.input"

@InputType()
/** The bounded save loyalty program arguments. */
export class SaveLoyaltyProgramInput {
    /** The name. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    name?: string | null

    /** The enabled. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean | null

    /** The config. */
    @Field(() => LoyaltyConfigInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => LoyaltyConfigInput)
    config?: LoyaltyConfigInput | null
}
