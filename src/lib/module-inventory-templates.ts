import building from "../../resources/inventory-templates/building.json";
import cafe from "../../resources/inventory-templates/cafe.json";
import retail from "../../resources/inventory-templates/retail.json";
import spa from "../../resources/inventory-templates/spa.json";

/**
 * Starter data per kind of business, loaded from resources/inventory-templates/<key>.json (the data is not in code). The owner picks one in the workbench
 * and gets items, suppliers and recipes to edit; SKUs that already exist are left alone.
 */
export type TemplateSupplier = {
  readonly name: string; readonly contact_name?: string; readonly email?: string; readonly phone?: string; readonly zalo?: string;
  readonly channel: "email" | "zalo" | "phone"; readonly lead_time_days: number; readonly payment_terms?: string;
};
export type TemplateItem = {
  readonly sku: string; readonly name: string; readonly unit: string; readonly units?: ReadonlyArray<{ readonly unit: string; readonly factor: number }>; readonly category: string;
  readonly cost_vnd: number; readonly sell_price_vnd?: number; readonly reorder_point: number; readonly reorder_qty: number; readonly supplier?: string;
  readonly aliases?: ReadonlyArray<string>; readonly qty: number;
};
export type TemplateRecipe = { readonly name: string; readonly aliases?: ReadonlyArray<string>; readonly lines: ReadonlyArray<{ readonly sku: string; readonly qty: number }> };
export type InventoryTemplate = {
  readonly key: string; readonly name: string; readonly description: string;
  readonly suppliers: ReadonlyArray<TemplateSupplier>; readonly items: ReadonlyArray<TemplateItem>; readonly recipes: ReadonlyArray<TemplateRecipe>;
};

export const INVENTORY_TEMPLATES: ReadonlyArray<InventoryTemplate> = [cafe, retail, building, spa] as unknown as ReadonlyArray<InventoryTemplate>;
export const templateOf = (key: string): InventoryTemplate | null => INVENTORY_TEMPLATES.find((t) => t.key === key) ?? null;
