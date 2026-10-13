/** A message of a person to a Page, as its messaging window records it. */
export interface ThreadTouch {
    /** The connection of the Page. */
    readonly connectionId: string
    /** Facebook or Instagram. */
    readonly platform: string
    /** The person on the platform. */
    readonly userId: string
    /** When the person wrote, ISO 8601. */
    readonly at: string
}
