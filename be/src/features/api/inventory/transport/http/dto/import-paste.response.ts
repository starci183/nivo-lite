/** The HTTP response of import items from a pasted table. */
export class ImportPasteResponse {
    /** Items created. */
    created!: number
    /** Items updated. */
    updated!: number
    /** Items given an opening quantity. */
    stocked!: number
    /** The lines that could not be read. */
    skipped!: Array<string>
}
