import { Field, InputType, Float } from "@nestjs/graphql"
import { IsNumber, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded loyalty category arguments. */
export class LoyaltyCategoryInput {
    /** The match. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    match!: string

    /** The per thousand vnd. */
    @Field(() => Float)
    @IsNumber()
    @Min(0)
    @Max(1000)
    perThousandVnd!: number

    /** The label. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    label!: string
}
