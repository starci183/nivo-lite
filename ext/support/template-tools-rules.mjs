// The decision of the project check `template-tools` (ext/checks/template-tools.mjs, doc ext/docs/checks/template-tools.md), pure: no file, no
// build, no package loaded. The program reads the built installation and hands the lists here. This file is no check: it lives in ext/support/
// because the harness's R103 refuses a file of ext/checks/ that ext/manifest.json `checks` does not declare.
// Concept: .starciwork/concepts/nivo-toolset.md ("Two default sets ... never listed in a template") and records.md ("Agent scope" rule 6).

/**
 * One tool list a declaration makes, as the program reads it from the installation:
 * `{ plugin, module, name, tools, requires, codeCalls }` where `name` is `agent` for the set a module's agent declares and a node's id for
 * a template node; `module` is the module key of the agent that places the node (`-` for a node no template agent places); `requires`
 * the tools a node makes a step require (`requires` of the node); `codeCalls` the tools the node's OWN code calls through `ctx.tools.call`,
 * read from the scripted tool answers of its examples (an example fails when a scripted answer goes unused or a call has none).
 */

/**
 * The tools a list names that a template never lists:
 * - `DEFAULT_NODE_TOOLS` (the record, file and timer tools): never, on any list. Every node holds them (`heldToolsOf`), code and AI step alike.
 * - `DEFAULT_AI_READ_TOOLS` (the read-context reads): never on a module agent's set (the engine adds them, `withDefaultReads`), and on a
 *   node's list only while the node's own CODE calls the tool (a node's code holds one only when it lists it; its AI step holds them all
 *   without listing) or the node `requires` it (the definition law keeps `requires` inside `tools`).
 * Each finding is `{ plugin, module, name, tool, set }`, `set` being `node-default` or `ai-read`.
 */
export const defaultToolFindings = (lists, { aiReadTools, nodeTools }) =>
    lists.flatMap((list) =>
        [...new Set(list.tools)].flatMap((tool) => {
            const finding = (set) => [{ plugin: list.plugin, module: list.module, name: list.name, tool, set }]
            if (nodeTools.includes(tool)) return finding("node-default")
            if (!aiReadTools.includes(tool)) return []
            const isNode = list.name !== "agent"
            const legitimate = isNode && ((list.codeCalls ?? []).includes(tool) || (list.requires ?? []).includes(tool))
            return legitimate ? [] : finding("ai-read")
        }),
    )

/** One line per finding: `plugin module agent/node tool`, in a fixed order. */
export const findingLines = (findings) =>
    [...findings]
        .sort((a, b) => [a.plugin, a.module, a.name, a.tool].join("\0").localeCompare([b.plugin, b.module, b.name, b.tool].join("\0")))
        .map((one) => `  ${one.plugin}  ${one.module}  ${one.name}  ${one.tool}`)

/** The counts by plugin, as `blocks-core 3, nivo-web-core 1`. */
export const countsByPlugin = (findings) => {
    const counts = {}
    for (const one of findings) counts[one.plugin] = (counts[one.plugin] ?? 0) + 1
    return Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => `${name} ${count}`)
        .join(", ")
}

/**
 * The lists of one installed plugin: its modules' agent sets and its template nodes (the ones it lists, the legacy `nodes` that carry a
 * `tools` member, and every node its template agents place, once per placing agent). `plugin` is the plugin object `definePlugin` made.
 */
export const listsOfPlugin = (plugin) => {
    const key = plugin.key ?? "?"
    const callsOf = (node) => (node.examples ?? []).flatMap((example) => (example.tools ?? []).map((call) => call.id))
    const nodeList = (module, node) => ({
        plugin: key,
        module,
        name: node.id,
        tools: node.tools ?? [],
        requires: node.requires ?? [],
        codeCalls: callsOf(node),
    })
    const agentLists = (plugin.modules ?? [])
        .filter((module) => module.agent !== undefined)
        .map((module) => ({ plugin: key, module: module.key, name: "agent", tools: module.agent.tools ?? [] }))
    const placed = (plugin.templateAgents ?? []).flatMap((agent) => {
        const nodes = new Map()
        for (const graph of agent.graphs ?? []) for (const [id, node] of graph.nodes ?? []) nodes.set(id, node)
        return [...nodes.values()].map((node) => nodeList(agent.key, node))
    })
    const placedIds = new Set(placed.map((list) => list.name))
    const unplaced = [...(plugin.templateNodes ?? []), ...(plugin.nodes ?? [])]
        .filter((node) => node.tools !== undefined && !placedIds.has(node.id))
        .map((node) => nodeList("-", node))
    return [...agentLists, ...placed, ...unplaced]
}
