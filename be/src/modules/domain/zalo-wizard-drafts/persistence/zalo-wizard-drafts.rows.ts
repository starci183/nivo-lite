/** The keys of a wizard draft, as FIND_WIZARD_DRAFT selects them. */
export interface WizardDraftRow {
    /** The Zalo app id. */
    readonly app_id: string | null
    /** The Zalo app secret. */
    readonly app_secret: string | null
    /** The OA Secret Key. */
    readonly oa_secret: string | null
}
