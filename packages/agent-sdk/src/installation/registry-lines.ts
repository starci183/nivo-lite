import type {
    InstallationKind,
    InstallationPart,
    InstalledEntity,
    InstalledJob,
    InstalledPlugin,
    PluginVisibility,
} from "./installation.types"
import { templateNodesOfPart } from "./installation"
import type { TemplateGraph } from "../template/builder/graph-builder.types"
import type { AnyTemplateNode } from "../template/builder/template-node.types"

/**
 * What the registry hash reads: the lists and records of one part, or of a whole installation (which holds the same lists joined and
 * its plugins as a list instead of one identity).
 */
export type RegistryContent<J extends InstalledJob = InstalledJob, E extends InstalledEntity = InstalledEntity> = Omit<
    InstallationPart<J, E>,
    "guidance" | "words"
> & {
    /** The plugins of an installation; a part names its own identity instead. */
    readonly plugins?: ReadonlyArray<InstalledPlugin> | undefined
}

/** The version a definition declares; 0 for a definition that declares none. */
const versionOf = (definition: object): number =>
    "version" in definition && typeof definition.version === "number" ? definition.version : 0

/** Orders strings by code unit, so the same lists give the same text on every machine. */
const byCodeUnit = (left: string, right: string): number => {
    if (left === right) return 0
    return left < right ? -1 : 1
}

/** The line `<kind>:<id>@<version>`. */
const lineOf = (kind: InstallationKind, id: string, definition: object): string =>
    `${kind}:${id}@${versionOf(definition)}`

/**
 * The version a template graph's registry line carries: its catalogue version, 1 for a graph with no catalogue (what the catalogue then
 * shows). As a legacy `template:<id>@<version>` line, the version, never a hash of the content: a new version of a graph changes the hash.
 */
const graphVersionOf = (graph: TemplateGraph): number => graph.spec.catalogue?.version ?? 1

/** The name the installation gives a part that names no key; such a part has no identity line. */
const UNNAMED = /^part\d+$/

/** The line of a plugin's identity: its key, who may use it and the enterprise identifiers it names, sorted. */
const pluginLine = (key: string, visibility: PluginVisibility, enterprises: ReadonlyArray<string>): string =>
    `plugin:${key}:${visibility}:${[...enterprises].sort(byCodeUnit).join(",")}@0`

/** The identity lines of a part (its own key) or of an installation (each plugin it lists). */
const pluginLines = (content: RegistryContent): ReadonlyArray<string> => [
    ...(content.key === undefined ? [] : [pluginLine(content.key, content.visibility ?? "public", content.enterprises ?? [])]),
    ...(content.plugins ?? [])
        .filter((plugin) => !UNNAMED.test(plugin.key))
        .map((plugin) => pluginLine(plugin.key, plugin.visibility, plugin.enterprises)),
]

/** One line per name of a record. */
const nameLines = (kind: InstallationKind, record: Readonly<Record<string, unknown>> | undefined): ReadonlyArray<string> =>
    Object.keys(record ?? {}).map((name) => `${kind}:${name}@0`)

/**
 * The lines the registry hash is taken over, sorted by code unit: `<kind>:<id>@<version>` per module, read, action, catalogue
 * template (`server`), block, node, effect, tool, data kind, job, entity, service and webhook event (the version being 0 when a definition declares none),
 * one per version of each workflow template (`template:<id>@<version>`), one per template node, template agent and template graph
 * (`template-node:<id>@0`, `template-agent:<key>@0`, `template-graph:<key>@<catalogue version, 1 without one>`), one per tool label, per node model and per message namespace,
 * one per source (`source:<key>:<dataKind>@0`) and one per named plugin with who may use it
 * (`plugin:<key>:<visibility>:<enterprises>@0`). Joined with newlines they are the text the generator hashes, so a change of what is
 * installed changes the hash and a reordering does not.
 */
export const registryLinesOf = <J extends InstalledJob, E extends InstalledEntity>(
    parts: ReadonlyArray<RegistryContent<J, E>>,
): ReadonlyArray<string> => {
    // A template node two parts place is ONE node of the installation, so one line: the first part that holds it gives it.
    const placed = new Set<AnyTemplateNode>()
    const ownNodes = (part: RegistryContent<J, E>): ReadonlyArray<AnyTemplateNode> =>
        templateNodesOfPart(part).filter((node) => {
            const isNew = !placed.has(node)
            placed.add(node)
            return isNew
        })
    return parts
        .flatMap((part) => [
            ...pluginLines(part),
            ...(part.modules ?? []).flatMap((module) => [
                lineOf("module", module.key, module),
                ...module.reads.map((read) => lineOf("read", read.id, read)),
                ...module.actions.map((action) => lineOf("action", action.id, action)),
            ]),
            ...(part.servers ?? []).map((server) => lineOf("server", server.key, server)),
            ...(part.blocks ?? []).map((block) => lineOf("block", block.id, block)),
            ...(part.nodes ?? []).map((node) => lineOf("node", node.id, node)),
            ...(part.effects ?? []).map((effect) => lineOf("effect", effect.id, effect)),
            ...(part.tools ?? []).map((tool) => lineOf("tool", tool.id, tool)),
            ...(part.dataKinds ?? []).map((kind) => lineOf("data-kind", kind.kind, kind)),
            ...nameLines("tool-label", part.toolLabels),
            ...(part.providers ?? []).map((template) => `provider:${template.kind}:${template.id}@0`),
            ...(part.templates ?? []).flatMap((template) =>
                template.versions.map((version) => `template:${template.id}@${version.version}`),
            ),
            ...ownNodes(part).map((node) => `template-node:${node.id}@0`),
            ...(part.templateAgents ?? []).flatMap((agent) => [
                `template-agent:${agent.key}@0`,
                ...agent.graphs.map((graph) => `template-graph:${graph.key}@${graphVersionOf(graph)}`),
            ]),
            ...nameLines("node-model", part.nodeModels),
            ...nameLines("messages", part.messages),
            ...(part.jobs ?? []).map((job) => lineOf("job", job.name, job)),
            ...(part.entities ?? []).map((entity) => lineOf("entity", entity.name, entity)),
            ...(part.services ?? []).map((service) => `service:${service.id}@0`),
            ...(part.webhookEvents ?? []).map((event) => `webhook-event:${event.id}@0`),
            ...(part.messageKinds ?? []).map((kind) => `message-kind:${kind.id}@0`),
        ])
        .sort(byCodeUnit)
}
