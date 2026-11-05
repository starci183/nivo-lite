import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { InstallationSource } from "./platform.types"

/** The installation of the app: the registry the back end runs and the modules the workspace has enabled. The door provides it. */
export const installationPort: PortDefinition<InstallationSource> =
    definePort<InstallationSource>("platform.installation")
