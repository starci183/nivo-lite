import type { ModuleAudience, OptionalModuleAudience } from "./module-audiences.contracts"

/** The audience of every catalogued module by key; the catalogue and the knowledge search both read it, so neither needs the other. */
export const MODULE_AUDIENCES = {
    chatbot: "customer",
    lead_gen: "customer",
    sales: "internal",
    accounting: "internal",
    shifts: "internal",
    booking: "customer",
    inventory: "internal",
    loyalty: "customer",
    video: "internal",
    content: "internal",
    hiring: "internal",
} as const satisfies Readonly<Record<string, ModuleAudience>>

/** The audience of the module with this key, or null when the catalogue has no such module. */
export function catalogAudienceOf(moduleKey: string): OptionalModuleAudience {
    return Object.entries(MODULE_AUDIENCES).find(([key]) => key === moduleKey)?.[1] ?? null
}
