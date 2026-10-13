import type { InstallationMode } from "@modules/domain/module-installations"

/** What setting the operating mode takes. */
export interface SetOperatingModeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** Assist asks for everything, autopilot follows the authority rules. */
    readonly mode: InstallationMode
}
