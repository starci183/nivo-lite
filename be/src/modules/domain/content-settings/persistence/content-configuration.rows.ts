/** A stored content-settings row. */
export interface ContentBrandRow {
    /** Stored workspace id value. */
    readonly workspace_id: string
    /** Stored brand voice value. */
    readonly brand_voice: string
    /** Stored avoid value. */
    readonly avoid: string
    /** Stored cta value. */
    readonly cta: string
    /** Stored hashtags value. */
    readonly hashtags: Array<string>
    /** Stored automations value. */
    readonly automations: Readonly<Record<string, unknown>>
    /** Stored marks value. */
    readonly marks: Readonly<Record<string, unknown>>
}
