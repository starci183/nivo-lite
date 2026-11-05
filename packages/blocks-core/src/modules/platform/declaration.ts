import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { PLATFORM_MODULE_KEY, PLATFORM_VIEW } from "./constants"
import { installationRead } from "./reads/installation.read"

/**
 * The platform module: what the back end runs. It has one read, `platform.installation`, and no screen: the front end reads it to learn
 * the modules the workspace has enabled and the hash of the registry, and shows "reload" when its own build differs.
 */
export const platformModule: ModuleDeclaration = defineModule({
    key: PLATFORM_MODULE_KEY,
    namespace: PLATFORM_MODULE_KEY,
    permissions: [PLATFORM_VIEW],
    reads: [installationRead],
    actions: [],
    specs: [],
})
