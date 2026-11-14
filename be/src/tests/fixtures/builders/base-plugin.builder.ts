import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import { defineModule } from "@nivo-lite/agent-sdk/module"
import { defineDataKind, defineNode, type DataKindDefinition, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { CORE_PLUGIN, NOTE_READ, NOTE_WRITE } from "./engine-core-plugin.builder"

/** The one control node of the base plugin, the id of a `defineNode` node as a package's first plugin names it. */
export const BASE_NODE_ID = "core.outcome"

/** The module of the base plugin that declares an agent. */
export const BASE_AGENT_MODULE = "baseagent"

/** The guidance the base plugin's agent declares, in both languages. */
export const BASE_GUIDANCE = { vi: "Doc truoc, tra loi sau.", en: "Read first, answer after." }

/** The one data kind of the base plugin. */
export const BASE_DATA_KIND = "base-note"

const outcome: NodeDefinition = defineNode({
    id: BASE_NODE_ID,
    role: "execute",
    title: { vi: "Ket qua", en: "Outcome" },
    params: z.object({}),
    input: z.object({}),
    output: z.object({}),
    effects: [],
    run: () => Promise.resolve({}),
    examples: [{ name: "one", params: {}, input: {}, output: {}, effects: [] }],
})

const note: DataKindDefinition = defineDataKind({
    kind: BASE_DATA_KIND,
    title: { vi: "Ghi chu", en: "Note" },
    fields: z.object({ text: z.string() }),
})

const agentModule = defineModule({
    key: BASE_AGENT_MODULE,
    namespace: BASE_AGENT_MODULE,
    permissions: [],
    reads: [],
    actions: [],
    specs: [],
    agent: { tools: [NOTE_READ] },
})

/**
 * A neutral FIRST plugin (key `core`) for the specs that prove how the installation joins plugins, without naming a package: a module
 * with no agent (`platform`), one with an agent (`baseagent`), one `defineNode` control node, one data kind, and the engine-core fixture's template agent with its tools.
 * The engine-core fixture's write effect is left to the plugin a spec adds beside it (the template fixture declares it too).
 */
export const BASE_PLUGIN: Plugin = definePlugin({
    ...CORE_PLUGIN,
    key: "core",
    label: { vi: "Nen", en: "Base" },
    modules: [defineModule({ key: "platform", namespace: "platform", permissions: [], reads: [], actions: [], specs: [] }), agentModule],
    guidance: (moduleKey, locale) => (moduleKey === BASE_AGENT_MODULE ? BASE_GUIDANCE[locale] : ""),
    words: (key) => (key === "baseNoteRead" ? "Reads one note" : undefined),
    nodes: [outcome],
    dataKinds: [note],
    effects: (CORE_PLUGIN.effects ?? []).filter((effect) => effect.id !== NOTE_WRITE),
})
