import type { InventoryTemplateType } from "@/hooks/swr"
import type { InventoryTemplateChoice } from "@/modules/types"

/** One starter set the back end offers, as the import card lists it. */
export const toTemplateChoice = (row: InventoryTemplateType): InventoryTemplateChoice => ({
    key: row.key,
    name: row.name,
    description: row.description,
})
