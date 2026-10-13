import type { ModuleCategory } from "./modules.contracts"

/** The categories the catalogue groups modules by, in display order. */
export const MODULE_CATEGORIES: ReadonlyArray<ModuleCategory> = [
    {
        key: "sales_customer",
        label: {
            vi: "B\u00e1n h\u00e0ng & kh\u00e1ch h\u00e0ng",
            en: "Sales and customers",
        },
    },
    {
        key: "operations",
        label: {
            vi: "V\u1eadn h\u00e0nh",
            en: "Operations",
        },
    },
    {
        key: "finance",
        label: {
            vi: "T\u00e0i ch\u00ednh",
            en: "Finance",
        },
    },
    {
        key: "marketing",
        label: {
            vi: "Marketing",
            en: "Marketing",
        },
    },
    {
        key: "hr",
        label: {
            vi: "Nh\u00e2n s\u1ef1",
            en: "People",
        },
    },
]
