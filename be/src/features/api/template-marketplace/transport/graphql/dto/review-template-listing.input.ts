import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The decision of a platform reviewer. */
export class ReviewTemplateListingInput {
    /** The listing. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    listingId!: string

    /** `approve` or `reject`. */
    @Field(() => String)
    @IsIn(["approve", "reject"])
    @MaxLength(10)
    decision!: "approve" | "reject"

    /** What the reviewer writes. */
    @Field(() => String)
    @IsString()
    @MaxLength(2000)
    note!: string

    /** The percent that is the creator, when it is not the default. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    revenueSharePct!: number | null
}
