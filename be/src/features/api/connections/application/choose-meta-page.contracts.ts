/** What chooseMetaPage takes. */
export interface ChooseMetaPageRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The Page. */
    readonly pageId: string
}
