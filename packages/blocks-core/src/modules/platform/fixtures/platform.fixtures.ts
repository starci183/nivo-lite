import type { ModuleFixtures } from "../../module-fixtures"
import type { InstallationFacts, InstallationView } from "../platform.types"

/** An installation with one enabled module and one the workspace has not enabled. */
export const INSTALLATION: InstallationView = {
    registryHash: "8f6b9c113b15db934d20405ff96ac98a8fe24a13b5dbd99ac70af5703629d39c",
    modules: [
        {
            key: "sales",
            enabled: true,
            permissions: ["sales.view", "sales.manage"],
            reads: ["sales.leads"],
            actions: ["sales.move-stage"],
            views: ["pipeline"],
        },
        {
            key: "loyalty",
            enabled: false,
            permissions: ["loyalty.view"],
            reads: ["loyalty.members"],
            actions: [],
            views: [],
        },
    ],
}

/** What the back end knows when it produces `INSTALLATION`: the same modules, with only `sales` enabled. */
export const INSTALLATION_FACTS: InstallationFacts = {
    registryHash: INSTALLATION.registryHash,
    modules: [
        {
            key: "sales",
            permissions: ["sales.view", "sales.manage"],
            reads: ["sales.leads"],
            actions: ["sales.move-stage"],
            views: ["pipeline"],
        },
        { key: "loyalty", permissions: ["loyalty.view"], reads: ["loyalty.members"], actions: [], views: [] },
    ],
    enabled: ["sales"],
}

/** The installation of a back end that runs no module. */
export const INSTALLATION_NONE: InstallationView = { registryHash: INSTALLATION.registryHash, modules: [] }

/** What the prototype data port answers for the platform module. */
export const PLATFORM_FIXTURES: ModuleFixtures = {
    reads: { "platform.installation": { ready: INSTALLATION, empty: INSTALLATION_NONE } },
    actions: {},
}
