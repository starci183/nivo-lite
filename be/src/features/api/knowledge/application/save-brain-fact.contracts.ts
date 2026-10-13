/** What the SaveBrainFact operation takes. */
export interface SaveBrainFactRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** What it is about. */
    readonly subjectType: "business" | "product" | "service" | "policy" | "customer" | "person" | "supplier" | "place" | "other"
    /** The subject. */
    readonly subjectLabel: string
    /** The attribute. */
    readonly attributeLabel: string
    /** The value. */
    readonly value: string
    /** `public`, `internal` or `restricted`. */
    readonly scope: "public" | "internal" | "restricted"
    /** The modules that may read a restricted fact. */
    readonly modules: Array<string>
    /** From when it holds, ISO 8601. */
    readonly validFrom?: string
    /** Until when it holds, ISO 8601. */
    readonly validTo?: string
    /** A note kept as evidence. */
    readonly note?: string
    /** The customer question this fact answers. */
    readonly gapId?: string
}
