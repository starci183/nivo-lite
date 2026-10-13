import building from "../../../resources/inventory-templates/building.json"
import cafe from "../../../resources/inventory-templates/cafe.json"
import retail from "../../../resources/inventory-templates/retail.json"
import spa from "../../../resources/inventory-templates/spa.json"
import type { InventoryTemplateChoice, StarterInput } from "@/modules/types"

/** One supplier of a template file. */
interface TemplateSupplier {
    readonly name: string
    readonly contact_name?: string
    readonly email?: string
    readonly phone?: string
    readonly zalo?: string
    readonly channel: string
    readonly lead_time_days: number
    readonly payment_terms?: string
}

/** One item of a template file. */
interface TemplateItem {
    readonly sku: string
    readonly name: string
    readonly unit: string
    readonly units?: ReadonlyArray<{ readonly unit: string; readonly factor: number }>
    readonly category: string
    readonly cost_vnd: number
    readonly sell_price_vnd?: number
    readonly reorder_point: number
    readonly reorder_qty: number
    readonly supplier?: string
    readonly aliases?: ReadonlyArray<string>
    readonly qty: number
}

/** One recipe of a template file. */
interface TemplateRecipe {
    readonly name: string
    readonly aliases?: ReadonlyArray<string>
    readonly lines: ReadonlyArray<{ readonly sku: string; readonly qty: number }>
}

/** One template file. */
interface TemplateData {
    readonly key: string
    readonly name: string
    readonly description: string
    readonly suppliers: ReadonlyArray<TemplateSupplier>
    readonly items: ReadonlyArray<TemplateItem>
    readonly recipes: ReadonlyArray<TemplateRecipe>
}

/** The starter sets per kind of business, read from resources/inventory-templates/<key>.json (the data is not in code). */
const TEMPLATES: ReadonlyArray<TemplateData> = [cafe, retail, building, spa]

/** The starter sets a business can pick from: key, name and what it brings. */
export const TEMPLATE_CHOICES: ReadonlyArray<InventoryTemplateChoice> = TEMPLATES.map((template) => ({
    key: template.key,
    name: template.name,
    description: template.description,
}))

/** The request that loads one starter set, or null for an unknown key. */
export const starterOf = (key: string): StarterInput | null => {
    const template = TEMPLATES.find((entry) => entry.key === key)
    if (template === undefined) return null
    return {
        name: template.name,
        suppliers: template.suppliers.map((supplier) => ({
            name: supplier.name,
            ...(supplier.contact_name === undefined ? {} : { contactName: supplier.contact_name }),
            ...(supplier.email === undefined ? {} : { email: supplier.email }),
            ...(supplier.phone === undefined ? {} : { phone: supplier.phone }),
            ...(supplier.zalo === undefined ? {} : { zalo: supplier.zalo }),
            channel: supplier.channel,
            leadTimeDays: supplier.lead_time_days,
            ...(supplier.payment_terms === undefined ? {} : { paymentTerms: supplier.payment_terms }),
        })),
        items: template.items.map((item) => ({
            sku: item.sku,
            name: item.name,
            unit: item.unit,
            ...(item.units === undefined
                ? {}
                : { units: item.units.map((entry) => ({ unit: entry.unit, factor: entry.factor })) }),
            category: item.category,
            costVnd: item.cost_vnd,
            ...(item.sell_price_vnd === undefined ? {} : { sellPriceVnd: item.sell_price_vnd }),
            reorderPoint: item.reorder_point,
            reorderQty: item.reorder_qty,
            ...(item.supplier === undefined ? {} : { supplier: item.supplier }),
            ...(item.aliases === undefined ? {} : { aliases: item.aliases }),
            qty: item.qty,
        })),
        recipes: template.recipes.map((recipe) => ({
            name: recipe.name,
            ...(recipe.aliases === undefined ? {} : { aliases: recipe.aliases }),
            lines: recipe.lines.map((line) => ({ sku: line.sku, qty: line.qty })),
        })),
    }
}
