import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { InstallationSource, MemberDirectory } from "./platform.types"

/** The installation of the app: the registry the back end runs and the modules the workspace has enabled. The door provides it. */
export const installationPort: PortDefinition<InstallationSource> =
    definePort<InstallationSource>("platform.installation")

/** The active seats of the workspace: who acts, by the name shown and whether they manage. The door provides it. */
export const membersPort: PortDefinition<MemberDirectory> = definePort<MemberDirectory>("platform.members")
