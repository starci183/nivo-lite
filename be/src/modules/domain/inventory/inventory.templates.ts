import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { InventoryTemplateInfo } from "./inventory-workbench.contracts"
import type { ApplyStarterParams } from "./inventory-operations.contracts"
import { BUILDING_TEMPLATE } from "./messages/inventory-template-building.messages"
import { CAFE_TEMPLATE } from "./messages/inventory-template-cafe.messages"
import { RETAIL_TEMPLATE } from "./messages/inventory-template-retail.messages"
import { SPA_TEMPLATE } from "./messages/inventory-template-spa.messages"

/** One starter set: the label the chooser shows and the payload the apply call loads. */
export interface InventoryTemplate extends InventoryTemplateInfo {
    /** The starter payload. */
    readonly starter: ApplyStarterParams
}

/** Every starter set a business can pick. */
export const INVENTORY_TEMPLATES: ReadonlyArray<InventoryTemplate> = [
    CAFE_TEMPLATE,
    RETAIL_TEMPLATE,
    BUILDING_TEMPLATE,
    SPA_TEMPLATE,
]

/** The starter payload of one key; an unknown key is invalid. */
export const inventoryStarterOf = (key: string): ApplyStarterParams => {
    const template = INVENTORY_TEMPLATES.find((entry) => entry.key === key)
    if (template === undefined) throw new InventoryError({ code: InventoryErrorCode.StarterUnknown })
    return template.starter
}
