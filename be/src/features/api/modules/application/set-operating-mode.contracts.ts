import type { InstallationMode } from "@modules/domain/module-installations"

/** What setting the operating mode takes. */
export interface SetOperatingModeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** The mode the web sends; nothing reads it (the switch is gone). */
    readonly mode: InstallationMode
}
