import { installed } from "@nivo-lite/plugin-registry"
import type { RegistryCheck } from "@nivo-lite/agent-sdk/client"

/** What the back end serves of the installation: the modules enabled for the workspace and the hash of its registry. */
interface ServedInstallation {
    /** The keys of the modules enabled for the workspace. */
    readonly enabled: ReadonlyArray<string>
    /** The hash of the installed registry the back end runs. */
    readonly registryHash: string
}

/** What the host provider takes of the installation. */
export interface WorkbenchInstallation {
    /** The keys of the modules enabled for the workspace. */
    readonly enabled: ReadonlyArray<string>
    /** The registry comparison; null where there is no back-end registry to compare with. */
    readonly registry: RegistryCheck | null
}

/** The hash of the installed registry this bundle was generated with. */
export const BUILT_REGISTRY_HASH: string = installed.registryHash

/** The key of every module installed in this bundle. */
const INSTALLED_MODULE_KEYS: ReadonlyArray<string> = installed.modules.map((declaration) => declaration.key)

const OWN: ServedInstallation = { enabled: INSTALLED_MODULE_KEYS, registryHash: BUILT_REGISTRY_HASH }

/**
 * The installation the back end serves. The one function to replace when the back end read `platform.installation` lands: until then
 * the back end runs the registry this bundle was generated from and enables every installed module.
 */
export const servedInstallation = (): ServedInstallation => OWN

/** A prototype enables every installed module and has no back-end registry to compare with, so it never shows the reload notice. */
export const PROTOTYPE_INSTALLATION: WorkbenchInstallation = { enabled: INSTALLED_MODULE_KEYS, registry: null }

/** The installation id a prototype build opens every workbench on. */
export const PROTOTYPE_INSTALLATION_ID = "prototype"
