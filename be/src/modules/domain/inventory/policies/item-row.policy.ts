import type { InventoryItem, UnitConversion } from "../inventory.contracts"
import { columnNumber } from "./number-format.policy"

/** The columns of an item row the domain reads; the driver answers numeric columns as exact decimal text. */
export interface ItemRowColumns {
    /** The item id. */
    readonly id: string
    /** The item code. */
    readonly sku: string
    /** The item name. */
    readonly name: string
    /** The base unit. */
    readonly unit: string
    /** The other units as stored json. */
    readonly units: unknown
    /** The item group. */
    readonly category: string
    /** The cost per base unit. */
    readonly cost_vnd: number | string
    /** The selling price per base unit. */
    readonly sell_price_vnd: number | string | null
    /** The low-stock level. */
    readonly reorder_point: number | string
    /** The usual order quantity. */
    readonly reorder_qty: number | string
    /** The usual supplier. */
    readonly supplier_id: string | null
    /** Other names. */
    readonly aliases: Array<string>
    /** Whether the item is in use. */
    readonly active: boolean
}

const isConversion = (value: unknown): value is { unit: string; factor: number | string } =>
    typeof value === "object" && value !== null && "unit" in value && "factor" in value

const toUnits = (units: ItemRowColumns["units"]): Array<UnitConversion> =>
    Array.isArray(units)
        ? units.flatMap((entry) =>
              isConversion(entry) && entry.unit !== "" && columnNumber(entry.factor) > 0
                  ? [{ unit: String(entry.unit), factor: columnNumber(entry.factor) }]
                  : [],
          )
        : []

/** Maps a stored item row to the item the domain works with: numeric columns arrive as strings and become numbers. */
export const toInventoryItem = (row: ItemRowColumns): InventoryItem => ({
    id: row.id,
    sku: row.sku,
    name: row.name,
    unit: row.unit,
    units: toUnits(row.units),
    category: row.category,
    costVnd: columnNumber(row.cost_vnd),
    sellPriceVnd: row.sell_price_vnd === null ? null : columnNumber(row.sell_price_vnd),
    reorderPoint: columnNumber(row.reorder_point),
    reorderQty: columnNumber(row.reorder_qty),
    supplierId: row.supplier_id,
    aliases: row.aliases,
    active: row.active,
})
