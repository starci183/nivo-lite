/** Who a module's agent talks to: customers, or only the business itself. */
export type ModuleAudience = "customer" | "internal"

/** The audience of a module that may not be in the catalogue: null when it is not. */
export type OptionalModuleAudience = ModuleAudience | null
