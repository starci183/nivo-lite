import { SdkDefinitionError } from "../block/definition-error"
import { packageKindRefusalOf } from "../team-chat/agent-message-kinds"
import { defineProviderTemplate } from "./provider-template"
import type { AnyTemplateNode } from "../template/builder/template-node.types"
import type {
    Installation,
    InstallationKind,
    InstallationPart,
    InstalledEntity,
    InstalledJob,
    InstalledPlugin,
    Plugin,
} from "./installation.types"

/** The shape of a plugin key and of an enterprise identifier: a short lowercase slug. */
const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** One id of one kind, with the part that declares it. */
interface Owned {
    readonly id: string
    readonly owner: string
}

/** The name a part is refused under: its key, or `part<index>` for a part that names none. */
const ownerOf = (part: InstallationPart, index: number): string => part.key ?? `part${index}`

/**
 * Refuses an id that two parts, or one part twice, declare for the same kind. The refusal is about `<kind>:<id>`; when the two
 * declarations are of different parts both owners are named after it (`module:sales (core, shop)`), so the generator's failure says
 * which two packages collide.
 */
const assertUnique = (kind: InstallationKind, ids: ReadonlyArray<Owned>): void => {
    const seen = new Map<string, string>()
    for (const { id, owner } of ids) {
        const first = seen.get(id)
        if (first !== undefined) {
            const owners = first === owner ? "" : ` (${first}, ${owner})`
            throw new SdkDefinitionError("INSTALLATION_ID_DUPLICATE", `${kind}:${id}${owners}`)
        }
        seen.set(id, owner)
    }
}

/** The ids a list of each part holds, each with its owner. */
const owned = <J extends InstalledJob, E extends InstalledEntity>(
    parts: ReadonlyArray<InstallationPart<J, E>>,
    idsOf: (part: InstallationPart<J, E>) => ReadonlyArray<string>,
): ReadonlyArray<Owned> => parts.flatMap((part, index) => idsOf(part).map((id) => ({ id, owner: ownerOf(part, index) })))

/** A record of every part, joined; the keys were proven unique before. */
const joined = <V>(records: ReadonlyArray<Readonly<Record<string, V>> | undefined>): Readonly<Record<string, V>> =>
    Object.fromEntries(records.flatMap((record) => Object.entries(record ?? {})))

/** Refuses a part whose identity is malformed: its key, or what it says of who may use it. */
const assertIdentity = (part: InstallationPart, index: number): void => {
    const owner = ownerOf(part, index)
    if (part.key !== undefined && !SLUG.test(part.key)) throw new SdkDefinitionError("ID_MALFORMED", `plugin:${part.key}`)
    if (part.packageName !== undefined && !SLUG.test(part.packageName)) {
        throw new SdkDefinitionError("ID_MALFORMED", `plugin:${owner}:package:${part.packageName}`)
    }
    const enterprises = part.enterprises ?? []
    const isPrivate = part.visibility === "private"
    if (isPrivate !== enterprises.length > 0) throw new SdkDefinitionError("PLUGIN_ACCESS_INVALID", `plugin:${owner}`)
    const bad = enterprises.find((enterprise) => !SLUG.test(enterprise))
    if (bad !== undefined) throw new SdkDefinitionError("ID_MALFORMED", `plugin:${owner}:${bad}`)
}

/**
 * Refuses a message kind a package declares that takes a core kind's id (`MESSAGE_KIND_CORE_ID`) or declares approve / reject
 * (`MESSAGE_KIND_VERDICT`): a verdict on /chat belongs to the core kinds only (owner chot 2026-11-13, nivo-frame `team-chat` rule 9).
 */
const assertPackageKinds = (part: InstallationPart, index: number): void => {
    for (const kind of part.messageKinds ?? []) {
        const refusal = packageKindRefusalOf(kind)
        if (refusal === "core_kind_id") throw new SdkDefinitionError("MESSAGE_KIND_CORE_ID", `message-kind:${kind.id} (${ownerOf(part, index)})`)
        if (refusal === "verdict_actions") throw new SdkDefinitionError("MESSAGE_KIND_VERDICT", `message-kind:${kind.id} (${ownerOf(part, index)})`)
    }
}

/**
 * The template nodes of a part: the ones it lists, then every node its template agents' graphs place that it does not list (the same
 * definition placed twice is one node; two DIFFERENT definitions of one id stay two, and the installation refuses them).
 */
export const templateNodesOfPart = (part: Pick<InstallationPart, "templateNodes" | "templateAgents">): ReadonlyArray<AnyTemplateNode> => {
    const placed = (part.templateAgents ?? []).flatMap((agent) => agent.graphs.flatMap((graph) => [...graph.nodes.values()]))
    return [...new Set([...(part.templateNodes ?? []), ...placed])]
}

/**
 * The template nodes of each part, in part order, a definition counted once in the whole installation (the first part that lists or places
 * it owns it): a plugin's graph may place a node of another package without declaring it twice.
 */
const templateNodesByPart = (parts: ReadonlyArray<InstallationPart>): ReadonlyArray<ReadonlyArray<AnyTemplateNode>> => {
    const seen = new Set<AnyTemplateNode>()
    return parts.map((part) => {
        const own: Array<AnyTemplateNode> = []
        for (const node of templateNodesOfPart(part)) {
            if (seen.has(node)) continue
            seen.add(node)
            own.push(node)
        }
        return own
    })
}

/** The keys of the graphs of a part's template agents: each is installed as a workflow template of that id. */
const templateGraphKeysOf = (part: Pick<InstallationPart, "templateAgents">): ReadonlyArray<string> =>
    (part.templateAgents ?? []).flatMap((agent) => agent.graphs.map((graph) => graph.key))

/** The plugin a part is, as the installation lists it. */
const pluginOf = (part: InstallationPart, index: number): InstalledPlugin => {
    const key = ownerOf(part, index)
    return {
        key,
        packageName: part.packageName ?? null,
        label: part.label ?? { vi: key, en: key },
        visibility: part.visibility ?? "public",
        enterprises: part.enterprises ?? [],
        modules: [
            ...new Set([
                ...(part.modules ?? []).map((module) => module.key),
                ...(part.servers ?? []).map((server) => server.key),
            ]),
        ],
        providers: (part.providers ?? []).map((template) => template.id),
    }
}

/**
 * A plugin: the ONE value a package built on the SDK exports to join an installation (its modules with their agents, nodes, effects,
 * tools and their words, workflow templates, entities, jobs, blocks, messages). Checked alone here, so a bad plugin fails its own
 * package: the key and the enterprise identifiers are slugs, a private plugin names at least one enterprise identifier and a public
 * one names none, and no id is declared twice inside it. `key` and `label` are required of a plugin.
 */
export const definePlugin = <J extends InstalledJob = InstalledJob, E extends InstalledEntity = InstalledEntity>(
    plugin: Plugin<J, E>,
): Plugin<J, E> => {
    defineInstallation([plugin], "")
    return plugin
}

/**
 * Joins the parts (the core package and every plugin package, each a `definePlugin` value) into the one installation the front end,
 * the door, the graph host, the step runner, the seed, the job runner and the entity engine are wired from. Throws
 * `SdkDefinitionError` `ID_MALFORMED` for a provider template of the wrong form (`defineProviderTemplate`),
 * `INSTALLATION_ID_DUPLICATE` (a service id, a webhook event id, or a (contract, module) pair of a service, declared twice; at `<kind>:<id>`, followed by the two owners when two parts collide) when two
 * plugins share a key, two modules or catalogue templates share a key, two blocks, nodes, effects, tools, data kinds, jobs or
 * entities share an id, two reads or two actions share an id, a tool has two labels or two modes, a node two model declarations, a
 * message namespace two catalogs, a provider (kind, id) two declarations, or a workflow template id (or one version number inside a template) is declared twice. A module's
 * ids already start with its key (`defineModule`), so one module key per installation keeps reads and actions apart. The registry
 * hash is the one the generator computed; the generated package holds it as a literal, because the browser bundle may not hash.
 */
export const defineInstallation = <J extends InstalledJob = InstalledJob, E extends InstalledEntity = InstalledEntity>(
    parts: ReadonlyArray<InstallationPart<J, E>>,
    registryHash: string,
): Installation<J, E> => {
    parts.forEach((part, index) => {
        assertIdentity(part, index)
        assertPackageKinds(part, index)
        for (const template of part.providers ?? []) defineProviderTemplate(template)
    })
    const keyed = <T>(list: (part: InstallationPart<J, E>) => ReadonlyArray<T> | undefined, idOf: (one: T) => string) =>
        owned(parts, (part) => (list(part) ?? []).map((one) => idOf(one)))
    const names = (record: (part: InstallationPart<J, E>) => Readonly<Record<string, unknown>> | undefined) =>
        owned(parts, (part) => Object.keys(record(part) ?? {}))
    assertUnique(
        "plugin",
        parts.map((part, index) => ({ id: ownerOf(part, index), owner: ownerOf(part, index) })),
    )
    assertUnique(
        "module",
        keyed(
            (part) => part.modules,
            (module) => module.key,
        ),
    )
    assertUnique(
        "server",
        keyed(
            (part) => part.servers,
            (server) => server.key,
        ),
    )
    assertUnique(
        "read",
        owned(parts, (part) => (part.modules ?? []).flatMap((module) => module.reads.map((read) => read.id))),
    )
    assertUnique(
        "action",
        owned(parts, (part) => (part.modules ?? []).flatMap((module) => module.actions.map((action) => action.id))),
    )
    assertUnique(
        "block",
        keyed(
            (part) => part.blocks,
            (block) => block.id,
        ),
    )
    // One node id is ONE form while the conversion runs: a `defineNode` node and a template node may not share it.
    const templateNodes = templateNodesByPart(parts)
    assertUnique(
        "node",
        parts.flatMap((part, index) =>
            [...(part.nodes ?? []), ...(templateNodes[index] ?? [])].map((node) => ({ id: node.id, owner: ownerOf(part, index) })),
        ),
    )
    assertUnique(
        "template-agent",
        keyed(
            (part) => part.templateAgents,
            (agent) => agent.key,
        ),
    )
    assertUnique(
        "effect",
        keyed(
            (part) => part.effects,
            (effect) => effect.id,
        ),
    )
    assertUnique(
        "tool",
        keyed(
            (part) => part.tools,
            (tool) => tool.id,
        ),
    )
    assertUnique(
        "data-kind",
        keyed(
            (part) => part.dataKinds,
            (kind) => kind.kind,
        ),
    )
    assertUnique(
        "tool-label",
        names((part) => part.toolLabels),
    )
    assertUnique(
        "provider",
        keyed(
            (part) => part.providers,
            (template) => `${template.kind}:${template.id}`,
        ),
    )
    assertUnique(
        "node-model",
        names((part) => part.nodeModels),
    )
    assertUnique(
        "messages",
        names((part) => part.messages),
    )
    // A template graph is installed as a workflow template of its key: no legacy template and no other graph may hold that id.
    assertUnique(
        "template",
        owned(parts, (part) => [...(part.templates ?? []).map((template) => template.id), ...templateGraphKeysOf(part)]),
    )
    assertUnique(
        "template",
        owned(parts, (part) =>
            (part.templates ?? []).flatMap((template) =>
                template.versions.map((version) => `${template.id}@${version.version}`),
            ),
        ),
    )
    assertUnique(
        "job",
        keyed(
            (part) => part.jobs,
            (job) => job.name,
        ),
    )
    assertUnique(
        "entity",
        keyed(
            (part) => part.entities,
            (entity) => entity.name,
        ),
    )
    assertUnique(
        "service",
        keyed(
            (part) => part.services,
            (service) => service.id,
        ),
    )
    assertUnique(
        "message-kind",
        keyed(
            (part) => part.messageKinds,
            (kind) => kind.id,
        ),
    )
    assertUnique(
        "webhook-event",
        keyed(
            (part) => part.webhookEvents,
            (event) => event.id,
        ),
    )
    // A contract has at most one implementation per module: the engine finds it by (contract, module).
    assertUnique(
        "service-slot",
        keyed(
            (part) => part.services,
            (service) => `${service.contract.id}@${service.moduleKey}`,
        ),
    )
    const plugins = parts.map((part, index) => pluginOf(part, index))
    const guidanceOf = (moduleKey: string, locale: "vi" | "en"): string => {
        const at = plugins.findIndex((plugin) => plugin.modules.includes(moduleKey))
        return parts[at]?.guidance?.(moduleKey, locale) ?? ""
    }
    const wordsOf = (key: string): string | undefined => {
        for (const part of parts) {
            const words = part.words?.(key)
            if (words !== undefined) return words
        }
        return undefined
    }
    return {
        plugins,
        modules: parts.flatMap((part) => part.modules ?? []),
        servers: parts.flatMap((part) => part.servers ?? []),
        blocks: parts.flatMap((part) => part.blocks ?? []),
        nodes: parts.flatMap((part) => part.nodes ?? []),
        effects: parts.flatMap((part) => part.effects ?? []),
        tools: parts.flatMap((part) => part.tools ?? []),
        dataKinds: parts.flatMap((part) => part.dataKinds ?? []),
        toolLabels: joined(parts.map((part) => part.toolLabels)),
        providers: parts.flatMap((part) => part.providers ?? []),
        templates: parts.flatMap((part) => part.templates ?? []),
        templateNodes: templateNodes.flat(),
        templateAgents: parts.flatMap((part) => part.templateAgents ?? []),
        nodeModels: joined(parts.map((part) => part.nodeModels)),
        messages: joined(parts.map((part) => part.messages)),
        jobs: parts.flatMap((part) => part.jobs ?? []),
        entities: parts.flatMap((part) => part.entities ?? []),
        services: parts.flatMap((part) => part.services ?? []),
        webhookEvents: parts.flatMap((part) => part.webhookEvents ?? []),
        messageKinds: parts.flatMap((part) => part.messageKinds ?? []),
        guidanceOf,
        wordsOf,
        registryHash,
    }
}
