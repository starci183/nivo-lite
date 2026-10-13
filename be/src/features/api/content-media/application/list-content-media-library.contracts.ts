/** Arguments for listing the media of the selected workspace. */
export interface ListContentMediaLibraryRequest {
    /** The selected workspace; the service proves membership. */
    readonly workspaceId: string
    /** The maximum files to show, between one and eighty. */
    readonly limit: number
}
