import { Field, ID, InputType } from "@nestjs/graphql"
import {
    IsString,
    MinLength,
    MaxLength,
    IsArray,
    ArrayMinSize,
    ArrayMaxSize,
    IsIn,
    IsOptional,
    IsISO8601,
    IsUUID,
} from "class-validator"

@InputType()
/** Bounded fields for a manual idea. */
export class CreateContentItemInput {
    /** The title field. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title!: string
    /** The channels field. */
    @Field(() => [String])
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(4)
    @IsIn(["facebook", "zalo", "tiktok", "instagram"], { each: true })
    channels!: Array<string>
    /** The scheduledAt field. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsISO8601()
    @MaxLength(40)
    scheduledAt?: string | null
    /** The pillarId field. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    pillarId?: string | null
}
