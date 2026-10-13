import { Field, ID, Float, ObjectType } from "@nestjs/graphql"
import { InventoryItemUnitType } from "./inventory-item-unit.type"
import { InventoryLevelType } from "./inventory-level.type"

@ObjectType()
/** One catalogue item with its stock. */
export class InventoryItemType {
    /** The item id. */
    @Field(() => ID)
    id!: string

    /** The item code. */
    @Field(() => String)
    sku!: string

    /** The item name. */
    @Field(() => String)
    name!: string

    /** The base unit. */
    @Field(() => String)
    unit!: string

    /** Other units. */
    @Field(() => [[InventoryItemUnitType]])
    units!: ReadonlyArray<InventoryItemUnitType>

    /** The item group. */
    @Field(() => String)
    category!: string

    /** The cost per base unit. */
    @Field(() => Float)
    costVnd!: number

    /** The selling price per base unit. */
    @Field(() => Float, { nullable: true })
    sellPriceVnd!: number | null

    /** The low-stock level. */
    @Field(() => Float)
    reorderPoint!: number

    /** The usual order quantity. */
    @Field(() => Float)
    reorderQty!: number

    /** The usual supplier. */
    @Field(() => ID, { nullable: true })
    supplierId!: string | null

    /** Other names. */
    @Field(() => [[String]])
    aliases!: ReadonlyArray<string>

    /** Whether the item is in use. */
    @Field(() => Boolean)
    active!: boolean

    /** The quantity on hand across locations. */
    @Field(() => Float)
    total!: number

    /** The stock state. */
    @Field(() => String)
    status!: string

    /** The quantity open purchase orders still owe. */
    @Field(() => Float)
    onOrder!: number

    /** The level at each location. */
    @Field(() => [[InventoryLevelType]])
    levels!: ReadonlyArray<InventoryLevelType>
}
