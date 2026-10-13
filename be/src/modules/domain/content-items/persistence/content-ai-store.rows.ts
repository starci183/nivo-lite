/** The quick idea insert result used to guard delayed draft application. */
export interface ContentQuickIdeaRow {
    /** The new content item. */
    readonly id: string
    /** The exact initial editor revision returned by PostgreSQL. */
    readonly updated_at: string | Date
}
