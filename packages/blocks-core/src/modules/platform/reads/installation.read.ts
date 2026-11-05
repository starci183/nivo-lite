import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { installationViewOf } from "../installation-view"
import { PLATFORM_VIEW } from "../constants"
import { installationPort } from "../ports"
import type { InstallationView } from "../platform.types"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/**
 * `platform.installation`: the enabled modules of the workspace with their permissions, reads, actions and spec views, and the hash
 * of the registry the back end runs, which the front end compares with its own build.
 */
export const installationRead: ReadDefinition = defineRead({
    id: "platform.installation",
    dataKind: "platform-installation",
    shape: "record",
    fields: ["registryHash", "modules"],
    paths: {},
    variables,
    permission: PLATFORM_VIEW,
    ports: { installation: installationPort },
    run: async ({ installation }): Promise<InstallationView> => installationViewOf(await installation.current()),
})
