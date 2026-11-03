import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** A saved version to offer on the marketplace. */
export class SubmitTemplateListingInput {
    /** The template key. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    templateKey!: string

    /** The version. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(100_000)
    version!: number

    /** The price in VND; zero is free. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(2_000_000_000)
    priceVnd!: number
}
