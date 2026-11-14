import type { GraphSpecV2 } from "@nivo-lite/agent-sdk/graph"
import { TOOL, type ProviderKey, type ToolId, type TriggerVerb } from "@nivo-lite/agent-sdk/names"
import {
    type AnyTemplateNode,
    type TemplateProblem,
    type TemplateToolLookup,
    type TemplateTriggerLookup,
    type TriggerSupply,
    askWritesProblems,
} from "@nivo-lite/agent-sdk/template"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { NIVO_OWNER, ownersOfTool, toolSpecOf } from "@modules/domain/tool-specs"
import { adapterOf, suppliesOfVerb, triggerCarrierOf, triggerSpecOf } from "@modules/domain/trigger-specs"

/** The pseudo-provider of NIVO's own tools (ruling B2): it owns every tool no provider owns. */
export const NIVO_PROVIDER = NIVO_OWNER

/** The core ids every tool spec of the engine is a total record over (contract C0). */
const CORE_TOOLS: ReadonlySet<string> = new Set(Object.values(TOOL))

/**
 * True when the owner (a provider, a source key, or `nivo`) owns the tool, from the engine's tool specs (`TOOL_SPECS`): a core tool by its
 * spec's owners, a source's generated tool by its source key; a tool no spec and no source owns (a plugin's own tool) is NIVO's.
 */
const ownedBy = (owner: string, tool: ToolId): boolean => {
    const owners = ownersOfTool(tool)
    return owners.length === 0 ? owner === NIVO_OWNER : owners.includes(owner)
}

/**
 * True for a tool that WRITES, as the engine knows it (the generic `mutates` fact): a core tool whose spec says so; an effect an installed
 * plugin defines; a tool an installed plugin defines that `mutates`. A read never asks; there is no mode per tool (nivo-frame `rights`).
 */
export const writesTool = (tool: string): boolean => {
    const held = toolSpecOf(tool)
    if (held !== null) return held.mutates
    const install = INSTALLED.nodeInstall()
    if (install.effects.some((effect) => effect.id === tool)) return true
    return install.tools.some((one) => one.id === tool && one.mutates)
}

/**
 * What the engine knows of tools, for the save checks of a template graph (`templateGraphProblems`): a tool is KNOWN when it is a core
 * name (`TOOL`), a tool or an effect an installed plugin defines, or a tool a source owns; a provider OWNS a tool by the engine's tool specs
 * (`ownedBy`), the pseudo-provider `nivo` every tool no provider owns. No mode is judged per tool: the node's ONE mode is required by the
 * SDK (`NODE_MODE_MISSING`), so there is no unstated write and no ask-only tool. `writes` (the engine's `writesTool`) turns on the SDK's
 * `NODE_ASK_WRITES_MANY` (nivo-frame `rights` rule 11e): a node step on `ask` declares at most ONE write tool.
 */
export const templateToolLookupOf = (): TemplateToolLookup => {
    const install = INSTALLED.nodeInstall()
    const defined = new Set([...install.tools.map((tool) => tool.id), ...install.effects.map((effect) => effect.id)])
    return {
        known: (tool) => CORE_TOOLS.has(tool) || defined.has(tool) || ownersOfTool(tool).length > 0,
        // `nivo` and the source keys are read as the keys they are, whatever `ProviderKey` of this program holds.
        owns: (provider: ProviderKey, tool) => ownedBy(provider, tool),
        writes: writesTool,
    }
}

/**
 * The tools a template node CALLS, as its own worked examples script them (`examples[].tools`, and the calls the model made in its agent
 * turns): the default record / file / timer tools every node holds undeclared show here, beside its declared ones. The examples are
 * the node's statement of what its code calls; the SDK requires at least one.
 */
export const calledToolsOf = (node: AnyTemplateNode): ReadonlyArray<ToolId> => [
    ...new Set(
        node.examples.flatMap((example): ReadonlyArray<ToolId> => [
            ...(example.tools ?? []).map((call) => call.id),
            ...(example.agent ?? []).flatMap((turn) => (turn.calls ?? []).map((call) => call.id)),
        ]),
    ),
]

/**
 * `NODE_ASK_WRITES_MANY` counting the writes a node step on `ask` CALLS (nivo-frame `rights` rule 11e, one approval card asks for one
 * write): its declared tools AND the default tools its examples call (`calledToolsOf`), so a node that writes a record and sends to the
 * customer under one `ask` is refused although it declares one write. A step the SDK's own check (declared tools, `writes` above)
 * already refuses is not named twice.
 */
export const askCalledWritesProblems = (
    spec: GraphSpecV2,
    nodes: ReadonlyMap<string, AnyTemplateNode>,
): ReadonlyArray<TemplateProblem<"NODE_ASK_WRITES_MANY">> =>
    spec.nodes.flatMap((step): ReadonlyArray<TemplateProblem<"NODE_ASK_WRITES_MANY">> => {
        if (step.kind !== "node") return []
        const node = nodes.get(step.step)
        if (node === undefined) return []
        if (askWritesProblems({ id: node.id, tools: node.tools, mode: step.mode }, writesTool).length > 0) return []
        return askWritesProblems(
            { id: node.id, tools: [...node.tools, ...calledToolsOf(node)], mode: step.mode },
            writesTool,
            `nodes.${step.key}.tools`,
        )
    })

/**
 * What the engine knows of trigger verbs, from the trigger registry (`TRIGGERS` of trigger-specs), PER PROVIDER: `workflow.called`
 * supplies what its caller maps; another verb supplies what the adapter of the provider asked (no provider: the verb's engine road)
 * supplies, read from today's catalogues and the members the verb declares (`suppliesOfVerb`). A verb without a spec, or a provider that does not serve the verb (Meta
 * today), is unknown (`TRIGGER_UNKNOWN`). `carriedBy`: a verb with an engine road takes no account, any other lists at least one provider
 * (every attached account of a listed provider is a source at bind time, one per stream).
 */
export const templateTriggerLookup: TemplateTriggerLookup = {
    supplies: (verb: TriggerVerb, provider?: ProviderKey): TriggerSupply => {
        const spec = triggerSpecOf(verb)
        if (spec === undefined) return { kind: "unknown" }
        if (spec.supply === "caller") return { kind: "caller" }
        const adapter = adapterOf(verb, provider)
        return adapter === undefined ? { kind: "unknown" } : { kind: "fixed", params: suppliesOfVerb(verb, adapter) }
    },
    carriedBy: (verb: TriggerVerb) => triggerCarrierOf(verb),
}
