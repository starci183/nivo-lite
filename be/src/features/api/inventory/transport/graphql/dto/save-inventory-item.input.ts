import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that create or update one catalogue item. */
export class SaveInventoryItemInput {
    /** The item to update; absent creates one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The item code; empty derives one from the name. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    sku!: string

    /** The item name. */
    @Field(() => String)
    @IsString()
    @MaxLength(160)
    name!: string

    /** The base unit all quantities are kept in. */
    @Field(() => String)
    @IsString()
    @MaxLength(30)
    unit!: string

    /** Other units as text, `unit=factor` pairs separated by commas. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    units!: string

    /** The item group. */
    @Field(() => String)
    @IsString()
    @MaxLength(80)
    category!: string

    /** The cost per base unit as typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    cost!: string

    /** The selling price per base unit as typed; empty for none. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    sell!: string

    /** The stock level at or below which the item is low, as typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    reorderPoint!: string

    /** The usual order quantity, as typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    reorderQty!: string

    /** The usual supplier id; empty for none. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    supplierId!: string

    /** Other names an order line may use, separated by commas. */
    @Field(() => String)
    @IsString()
    @MaxLength(600)
    aliases!: string

    /** The opening quantity, as typed; only a new item takes it. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    openingQty?: string
}
