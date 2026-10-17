import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { InventoryTemplateInfo } from "./inventory-workbench.contracts"
import type { ApplyStarterParams } from "./inventory-operations.contracts"
import { buildingTemplate } from "./messages/inventory-template-building.messages"
import { cafeTemplate } from "./messages/inventory-template-cafe.messages"
import { retailTemplate } from "./messages/inventory-template-retail.messages"
import { spaTemplate } from "./messages/inventory-template-spa.messages"

/** One starter set: the label the chooser shows and the payload the apply call loads. */
export interface InventoryTemplate extends InventoryTemplateInfo {
    /** The starter payload. */
    readonly starter: ApplyStarterParams
}

/** Every starter set a business can pick. */
export const INVENTORY_TEMPLATES: ReadonlyArray<InventoryTemplate> = [
    cafeTemplate(),
    retailTemplate(),
    buildingTemplate(),
    spaTemplate(),
]

/** The starter payload of one key; an unknown key is invalid. */
export const inventoryStarterOf = (key: string): ApplyStarterParams => {
    const template = INVENTORY_TEMPLATES.find((entry) => entry.key === key)
    if (template === undefined) throw new InventoryError({ code: InventoryErrorCode.StarterUnknown })
    return template.starter
}
