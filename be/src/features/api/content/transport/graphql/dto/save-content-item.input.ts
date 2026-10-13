import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
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
    ValidateNested,
} from "class-validator"
import { ContentVariantInput } from "./content-variant.input"
import { ContentLinkInput } from "./content-link.input"
import { ContentMediaRefInput } from "./content-media-ref.input"

@InputType()
/** Whitelisted optional editor fields. */
export class SaveContentItemInput {
    /** The id field. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
    /** The title field. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title?: string | null
    /** The channels field. */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(4)
    @IsIn(["facebook", "zalo", "tiktok", "instagram"], { each: true })
    channels?: Array<string> | null
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
    /** The brief field. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    brief?: string | null
    /** The hashtags field. */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    @MaxLength(80, { each: true })
    hashtags?: Array<string> | null
    /** The variants field. */
    @Field(() => [ContentVariantInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(4)
    @ValidateNested({ each: true })
    @Type(() => ContentVariantInput)
    variants?: Array<ContentVariantInput> | null
    /** The links field. */
    @Field(() => [ContentLinkInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @ValidateNested({ each: true })
    @Type(() => ContentLinkInput)
    links?: Array<ContentLinkInput> | null
    /** The media field. */
    @Field(() => [ContentMediaRefInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @ValidateNested({ each: true })
    @Type(() => ContentMediaRefInput)
    media?: Array<ContentMediaRefInput> | null
}
