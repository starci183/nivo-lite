import { catalogText } from "./policies/catalog-copy.policy"
import type { ModuleCategory } from "./modules.contracts"

/** The categories the catalogue groups modules by, in display order. */
export const MODULE_CATEGORIES: ReadonlyArray<ModuleCategory> = [
    {
        key: "sales_customer",
        label: catalogText("modulesCatalog.categories.sales_customer.label"),
    },
    {
        key: "operations",
        label: catalogText("modulesCatalog.categories.operations.label"),
    },
    {
        key: "finance",
        label: catalogText("modulesCatalog.categories.finance.label"),
    },
    {
        key: "marketing",
        label: catalogText("modulesCatalog.categories.marketing.label"),
    },
    {
        key: "hr",
        label: catalogText("modulesCatalog.categories.hr.label"),
    },
]
