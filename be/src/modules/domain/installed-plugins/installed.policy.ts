import type { Installation } from "@nivo-lite/agent-sdk/installation"
import { installed } from "@nivo-lite/plugin-registry"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { NATIVE_TOOL_DEFINITIONS } from "@modules/domain/tool-specs/native-tool-definitions.policy"
import type { InstalledPlugins } from "./installed-plugins.contracts"
import { installedPluginsOf } from "./installed-plugins.policy"
import { controlEffectsOf, installedStepOf, type OptionalInstalledStep } from "./installed-steps.policy"

/**
 * The plugins this app installs, as the generated registry joins them (`defineInstallation([core, ...plugins])`): the one value the
 * engine reads an agent, a tool, a template or a node declaration from. A package is added to the array by the generator
 * (`scripts/build-plugin-registry.mjs`), never by an import here. The engine's own definitions of its native tools join it
 * (`NATIVE_TOOL_DEFINITIONS` of tool-specs), so every reader knows them as installed tools.
 */
export const INSTALLED: InstalledPlugins = installedPluginsOf(installed, NATIVE_TOOL_DEFINITIONS)

/** The module declarations of the installation, in registry order: what the workbench door serves. Read here, the one root, never from the registry. */
export const INSTALLED_MODULES: Installation["modules"] = installed.modules

/** The hash of the installed registry: the front end compares its own with it. */
export const INSTALLED_REGISTRY_HASH: string = installed.registryHash

/** The ids of the installed effects, read once. */
const EFFECT_IDS: ReadonlySet<string> = new Set(INSTALLED.nodeInstall().effects.map((effect) => effect.id))

/**
 * The installed step of an id where the `defineNode` nodes are read from a node index the caller holds (the node registry's: the app's
 * install, a test's fixture nodes added), the template nodes from the installation: the same view as `INSTALLED.stepOf`, for a service
 * that reads its `defineNode` nodes through `GraphNodeRegistryService.installed()`.
 */
export const installedStepIn = (nodes: ReadonlyMap<string, NodeDefinition>, id: string): OptionalInstalledStep =>
    installedStepOf(id, {
        legacyNodeOf: (step) => nodes.get(step),
        templateNodeOf: INSTALLED.templateNodeOf,
        isEffect: (call) => EFFECT_IDS.has(call),
    })

/**
 * The effects the engine's CONTROL steps run themselves (`core.call-workflow`'s tag of the target agent): granted by the step itself, so
 * no agent declares them in its tool set and no workflow's grant is cut of them (the save check, the run grant and the run's effect check
 * read this one set).
 */
export const CONTROL_EFFECTS: ReadonlySet<string> = controlEffectsOf((id) => INSTALLED.nodeInstall().nodes.find((node) => node.id === id))
