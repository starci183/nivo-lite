import type { ModuleAudience, OptionalModuleAudience } from "./module-audiences.contracts"

/** The audience of every catalogued module, by key. */
interface ModuleAudiences {
    readonly [moduleKey: string]: ModuleAudience
    /** The audience of the chatbot module. */
    readonly chatbot: "customer"
    /** The audience of the lead_gen module. */
    readonly lead_gen: "customer"
    /** The audience of the sales module. */
    readonly sales: "internal"
    /** The audience of the accounting module. */
    readonly accounting: "internal"
    /** The audience of the shifts module. */
    readonly shifts: "internal"
    /** The audience of the booking module. */
    readonly booking: "customer"
    /** The audience of the inventory module. */
    readonly inventory: "internal"
    /** The audience of the loyalty module. */
    readonly loyalty: "customer"
    /** The audience of the video module. */
    readonly video: "internal"
    /** The audience of the content module. */
    readonly content: "internal"
    /** The audience of the hiring module. */
    readonly hiring: "internal"
}

/** The audience of every catalogued module by key; the catalogue and the knowledge search both read it, so neither needs the other. */
export const MODULE_AUDIENCES: ModuleAudiences = {
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
