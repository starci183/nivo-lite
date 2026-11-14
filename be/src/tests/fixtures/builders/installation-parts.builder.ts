import type { AnyEntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { defineInstallation, type Installation, type InstallationPart } from "@nivo-lite/agent-sdk/installation"
import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"

/** A part as the engine's own installation holds it: the job runner's and the entity engine's definitions. */
type EnginePart = InstallationPart<JobDefinition, AnyEntityDefinition>

/**
 * Spec support for a spec that mocks `@nivo-lite/plugin-registry` with the installed plugins PLUS its own fixture plugin (the engine
 * imports no plugin package by name: the installed plugins are read from the registry itself, then handed back as parts). Call it
 * only from a `jest.mock("@nivo-lite/plugin-registry", ...)` factory, through `jest.requireActual` of this file.
 */

/** The parts of the real installation: one per installed plugin, each with its own modules, catalogue templates and graphs. */
const partsOf = (installation: Installation): ReadonlyArray<EnginePart> =>
    installation.plugins.map((plugin, index): EnginePart => {
        const owns = (moduleKey: string): boolean => plugin.modules.includes(moduleKey)
        const modules = installation.modules.filter((module) => owns(module.key))
        const namespaces = new Set(modules.map((module) => module.namespace))
        const own: EnginePart = {
            key: plugin.key,
            ...(plugin.packageName === null ? {} : { packageName: plugin.packageName }),
            label: plugin.label,
            visibility: plugin.visibility,
            enterprises: plugin.enterprises,
            modules,
            servers: installation.servers.filter((server) => owns(server.key)),
            templates: installation.templates.filter((template) => owns(template.moduleKey)),
            templateAgents: installation.templateAgents.filter((agent) => owns(agent.key)),
            providers: installation.providers.filter((template) => plugin.providers.includes(template.id)),
            messages: Object.fromEntries(Object.entries(installation.messages).filter(([namespace]) => namespaces.has(namespace))),
            guidance: installation.guidanceOf,
            words: installation.wordsOf,
        }
        // What the registry holds by id (not by module) cannot be told apart per plugin: the first part, the core package, carries it.
        if (index > 0) return own
        return {
            ...own,
            blocks: installation.blocks,
            nodes: installation.nodes,
            effects: installation.effects,
            tools: installation.tools,
            dataKinds: installation.dataKinds,
            toolLabels: installation.toolLabels,
            templateNodes: installation.templateNodes,
            nodeModels: installation.nodeModels,
            jobs: installation.jobs,
            entities: installation.entities,
        }
    })

/** The installation the registry holds, as it is generated: the one way a spec reads the real installed plugins (this file is the test root). */
export const realInstallation = (): Installation => {
    const registry: { readonly installed: Installation } = jest.requireActual("@nivo-lite/plugin-registry")
    return registry.installed
}

/**
 * The installation of this app with other plugins added: the parts of the real PUBLIC plugins, then the extra ones. An extra part that declares a
 * provider template or a tool the installed plugins already declare replaces it (a CRM fixture's template `nivoweb`).
 */
export const installationWith = (extra: ReadonlyArray<EnginePart>, registryHash: string): Installation => {
    const real = realInstallation()
    const providers = new Set(extra.flatMap((part) => (part.providers ?? []).map((template) => template.id)))
    const tools = new Set(extra.flatMap((part) => (part.tools ?? []).map((tool) => tool.id)))
    // A private plugin of the registry (an enterprise's own) is left out: a spec's installation is the public plugins and what it adds.
    const base = partsOf(real)
        .filter((_part, index) => real.plugins[index]?.visibility === "public")
        .map(
            (part): EnginePart => ({
                ...part,
                providers: (part.providers ?? []).filter((template) => !providers.has(template.id)),
                tools: (part.tools ?? []).filter((tool) => !tools.has(tool.id)),
            }),
        )
    return defineInstallation([...base, ...extra], registryHash)
}
