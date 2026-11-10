import type { FactScope, FactSource, FactSubjectType } from "@/modules/types"

/** How far a source is believed, as a person reads it. */
export type TrustLevel = "high" | "medium" | "low"

/**
 * The level of a trust value: a score from 0 to 100 (75 and over high, 40 and over medium, else low) or a level word the wire may carry.
 * The raw value is never shown.
 */
export const trustLevelOf = (trust: number | string): TrustLevel => {
    if (trust === "high" || trust === "medium" || trust === "low") return trust
    const score = Number(trust)
    if (score >= 75) return "high"
    return score >= 40 ? "medium" : "low"
}

/** The catalog key of each trust level: the bare word, and the full label. */
export const TRUST_LEVEL_KEY: Readonly<
    Record<
        TrustLevel,
        {
            readonly word: "trustHigh" | "trustMedium" | "trustLow"
            readonly label: "trustLabelHigh" | "trustLabelMedium" | "trustLabelLow"
        }
    >
> = {
    high: { word: "trustHigh", label: "trustLabelHigh" },
    medium: { word: "trustMedium", label: "trustLabelMedium" },
    low: { word: "trustLow", label: "trustLabelLow" },
}

/** The catalog key (`brain` namespace) of each scope label. */
export const SCOPE_KEY: Readonly<Record<FactScope, "scopePublic" | "scopeInternal" | "scopeRestricted">> = {
    public: "scopePublic",
    internal: "scopeInternal",
    restricted: "scopeRestricted",
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
