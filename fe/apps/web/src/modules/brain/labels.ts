import type { FactScope, FactSource, FactSubjectType } from "@/modules/types"

/** The catalog key (`brain` namespace) of each scope label. */
export const SCOPE_KEY: Readonly<Record<FactScope, "scopePublic" | "scopeInternal" | "scopeRestricted">> = {
    public: "scopePublic",
    internal: "scopeInternal",
    restricted: "scopeRestricted",
}

/** The tone of the badge of each scope. */
export const SCOPE_TONE: Readonly<Record<FactScope, "success" | "neutral" | "warning">> = {
    public: "success",
    internal: "neutral",
    restricted: "warning",
}

/** The catalog key of each source label. */
export const FACT_SOURCE_KEY: Readonly<
    Record<FactSource, "srcOwner" | "srcManager" | "srcDocument" | "srcSystem" | "srcStaff" | "srcCustomer" | "srcAi">
> = {
    owner: "srcOwner",
    manager: "srcManager",
    document: "srcDocument",
    system: "srcSystem",
    staff: "srcStaff",
    customer: "srcCustomer",
    ai: "srcAi",
}

/** The catalog key of each subject type label. */
export const TYPE_KEY: Readonly<
    Record<
        FactSubjectType,
        "tBusiness" | "tProduct" | "tService" | "tPolicy" | "tCustomer" | "tPerson" | "tSupplier" | "tPlace" | "tOther"
    >
> = {
    business: "tBusiness",
    product: "tProduct",
    service: "tService",
    policy: "tPolicy",
    customer: "tCustomer",
    person: "tPerson",
    supplier: "tSupplier",
    place: "tPlace",
    other: "tOther",
}
