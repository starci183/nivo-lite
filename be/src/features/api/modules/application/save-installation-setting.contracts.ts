/** What saving a setting of an installation takes. */
export interface SaveInstallationSettingRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** The setting: openclawTimeoutSec or holdingMessage. */
    readonly name: string
    /** The value; null or an empty text removes the setting. */
    readonly value: string | number | null
}
