/** What the SubmitTemplateListing operation takes. */
export interface SubmitTemplateListingRequest {
    /** The template key. */
    readonly key: string
    /** The version to offer. */
    readonly version: number
    /** The price in VND; zero is free. */
    readonly priceVnd: number
}
