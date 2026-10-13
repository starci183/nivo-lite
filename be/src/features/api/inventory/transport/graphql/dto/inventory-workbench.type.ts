import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { InventoryLocationType } from "./inventory-location.type"
import { InventorySupplierType } from "./inventory-supplier.type"
import { InventoryItemType } from "./inventory-item.type"
import { InventoryRecipeType } from "./inventory-recipe.type"
import { InventoryPoType } from "./inventory-po.type"
import { InventoryMovementType } from "./inventory-movement.type"
import { InventoryPendingType } from "./inventory-pending.type"
import { InventoryMetricsType } from "./inventory-metrics.type"

@ObjectType()
/** The whole inventory workbench of a workspace. */
export class InventoryWorkbenchType {
    /** Whether the caller may change things. */
    @Field(() => Boolean)
    canManage!: boolean

    /** The default location, when one exists. */
    @Field(() => ID, { nullable: true })
    defaultLocationId!: string | null

    /** The stock locations. */
    @Field(() => [InventoryLocationType])
    locations!: ReadonlyArray<InventoryLocationType>

    /** The suppliers. */
    @Field(() => [InventorySupplierType])
    suppliers!: ReadonlyArray<InventorySupplierType>

    /** The items with their stock. */
    @Field(() => [InventoryItemType])
    items!: ReadonlyArray<InventoryItemType>

    /** The recipes. */
    @Field(() => [InventoryRecipeType])
    recipes!: ReadonlyArray<InventoryRecipeType>

    /** The purchase orders. */
    @Field(() => [InventoryPoType])
    pos!: ReadonlyArray<InventoryPoType>

    /** The recent movements. */
    @Field(() => [InventoryMovementType])
    movements!: ReadonlyArray<InventoryMovementType>

    /** The decisions waiting on the owner. */
    @Field(() => [InventoryPendingType])
    pending!: ReadonlyArray<InventoryPendingType>

    /** The ribbon figures. */
    @Field(() => InventoryMetricsType)
    metrics!: InventoryMetricsType

    /** Items that stocked out in the last 7 days; null when the history could not be read. */
    @Field(() => Int, { nullable: true })
    stockOuts7d!: number | null

    /** When the read ran. */
    @Field(() => String)
    nowIso!: string
}
