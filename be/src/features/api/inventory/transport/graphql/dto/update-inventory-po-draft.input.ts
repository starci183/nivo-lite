import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { UpdatePoLineInput } from "./update-po-line.input"

@InputType()
/** The bounded arguments that edit a draft purchase order. */
export class UpdateInventoryPoDraftInput {
    /** The purchase order. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    poId!: string

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

    /** The lines to change. */
    @Field(() => [[UpdatePoLineInput]])
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => UpdatePoLineInput)
    lines!: Array<UpdatePoLineInput>
}
