/** The columns of public.automation_templates the catalogue reads. */
export interface AutomationTemplatesRow {
    /** The template key. */
    readonly key: string
    /** The definition as stored, to be checked before it is used. */
    readonly definition: unknown
}
