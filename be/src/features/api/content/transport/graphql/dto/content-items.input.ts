import { Field, InputType } from "@nestjs/graphql"
import { IsISO8601, IsOptional, MaxLength } from "class-validator"

@InputType()
/** Optional scheduling bounds for a content list; the upper bound is exclusive. */
export class ContentItemsInput {
    /** Inclusive scheduled instant, ISO 8601. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsISO8601()
    @MaxLength(40)
    from?: string | null

    /** Exclusive scheduled instant, ISO 8601. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsISO8601()
    @MaxLength(40)
    to?: string | null
}
