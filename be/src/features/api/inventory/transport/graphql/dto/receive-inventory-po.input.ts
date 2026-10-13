import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { ReceivePoLineInput } from "./receive-po-line.input"

@InputType()
/** The bounded arguments that receive goods against a purchase order. */
export class ReceiveInventoryPoInput {
    /** The purchase order. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    poId!: string

    /** The supplier invoice number. */
    @Field(() => String)
    @IsString()
    @MaxLength(80)
    invoiceNo!: string

    /** A free note. */
    @Field(() => String)
    @IsString()
    @MaxLength(1000)
    note!: string

    /** The received lines. */
    @Field(() => [[ReceivePoLineInput]])
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => ReceivePoLineInput)
    lines!: Array<ReceivePoLineInput>
}
