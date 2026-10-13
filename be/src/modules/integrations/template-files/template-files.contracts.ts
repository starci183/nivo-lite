/** The definition files of the automation catalogue. */
export interface TemplateFiles {
    /** The catalogue definitions: the automation templates and the meta files of the n8n templates. */
    readDefinitions(): Promise<ReadonlyArray<unknown>>
}
