import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of create or update one catalogue item. */
export class SaveItemRequest {
    /** The item to update; absent creates one. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The item code; empty derives one from the name. */
    @IsString()
    @MaxLength(40)
    sku!: string

    /** The item name. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The base unit all quantities are kept in. */
    @IsString()
    @MaxLength(30)
    unit!: string

    /** Other units as text, `unit=factor` pairs separated by commas. */
    @IsString()
    @MaxLength(300)
    units!: string

    /** The item group. */
    @IsString()
    @MaxLength(60)
    category!: string

    /** The cost per base unit as typed. */
    @IsString()
    @MaxLength(30)
    cost!: string

    /** The selling price per base unit as typed; empty for none. */
    @IsString()
    @MaxLength(30)
    sell!: string

    /** The stock level at or below which the item is low, as typed. */
    @IsString()
    @MaxLength(30)
    reorderPoint!: string

    /** The usual order quantity, as typed. */
    @IsString()
    @MaxLength(30)
    reorderQty!: string

    /** The usual supplier id; empty for none. */
    @IsString()
    @MaxLength(36)
    supplierId!: string

    /** Other names an order line may use, separated by commas. */
    @IsString()
    @MaxLength(400)
    aliases!: string

    /** The opening quantity, as typed; only a new item takes it. */
    @IsOptional()
    @IsString()
    @MaxLength(30)
    openingQty?: string
}
