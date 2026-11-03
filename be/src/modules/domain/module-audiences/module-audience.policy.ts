import type { ModuleAudience, OptionalModuleAudience } from "./module-audiences.contracts"

/** The audience of every catalogued module by key; the catalogue and the knowledge search both read it, so neither needs the other. */
export const MODULE_AUDIENCES: {
    readonly chatbot: "customer"
    readonly lead_gen: "customer"
    readonly sales: "internal"
    readonly accounting: "internal"
    readonly shifts: "internal"
    readonly booking: "customer"
    readonly inventory: "internal"
    readonly loyalty: "customer"
    readonly video: "internal"
    readonly content: "internal"
    readonly hiring: "internal"
} = {
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
