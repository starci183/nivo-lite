/** What driveGrant takes. */
export interface GetDriveGrantRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

/** What driveGrant answers. */
export interface DriveGrantResult {
    /** `none`, `connected` or `lost`. */
    readonly state: string
    /** The Google account that gave the grant, blank when none. */
    readonly email: string
}
