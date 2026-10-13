import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsString, MaxLength, ValidateNested } from "class-validator"
import { CreatePoLineInput } from "./create-po-line.input"

@InputType()
/** The bounded arguments that create a purchase order. */
export class CreateInventoryPoInput {
    /** The supplier id; empty for none. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    supplierId!: string

    /** The expected date, YYYY-MM-DD, or empty. */
    @Field(() => String)
    @IsString()
    @MaxLength(20)
    expectedAt!: string

    /** The ordered items. */
    @Field(() => [CreatePoLineInput])
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => CreatePoLineInput)
    lines!: Array<CreatePoLineInput>
}
