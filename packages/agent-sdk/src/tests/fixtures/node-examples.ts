import type { EffectDefinition, ToolDefinition } from "../../node/effect.types"
import { runNode } from "../../node/host"
import type { NodeDefinition, NodeExample, NodeExampleEffect, TurnRef } from "../../node/node.types"
import { canonicalJson } from "../../template/canonical"
import type { FakeExecuted } from "./node-ports"
import { scriptedNodePorts } from "./node-ports"

/** The turn every example runs in. */
export const EXAMPLE_TURN: TurnRef = { turnId: "turn-1", workspaceId: "workspace-1", agentId: "agent-1", subject: null }

/** The kind an expected effect names. */
const kindOf = (expected: NodeExampleEffect): string => (typeof expected === "string" ? expected : expected.kind)

/** Whether a run effect is what the example expected at its place: its kind, and its payload when the example names one. */
const effectMatches = (expected: NodeExampleEffect, ran: FakeExecuted): boolean => {
    if (ran.id !== kindOf(expected)) return false
    return typeof expected === "string" || canonicalJson(expected.payload) === canonicalJson(ran.payload)
}

/** What differs between the effects an example expects and the ones its run did. */
const effectMismatches = (
    expected: ReadonlyArray<NodeExampleEffect>,
    ran: ReadonlyArray<FakeExecuted>,
): ReadonlyArray<string> => {
    if (expected.length !== ran.length) return [`effects: expected ${expected.length}, ran ${ran.length}`]
    return ran.flatMap((done, index) =>
        expected
            .slice(index, index + 1)
            .flatMap((entry) => (effectMatches(entry, done) ? [] : [`effect ${index}: expected ${kindOf(entry)}`])),
    )
}

/**
 * Runs one example of a node through the real runner over fake ports, with the example's grant (the node's own rights and tools when absent),
 * store and model script, and answers what differs from what it promised: its output and its effects in order. Empty means it holds.
 */
export const nodeExampleMismatches = async (
    node: NodeDefinition,
    example: NodeExample<NodeDefinition["input"], NodeDefinition["output"], NodeDefinition["params"]>,
    effects: ReadonlyArray<EffectDefinition>,
    tools: ReadonlyArray<ToolDefinition> = [],
): Promise<ReadonlyArray<string>> => {
    const fake = scriptedNodePorts({ store: example.store, model: example.model, tools: example.tools })
    try {
        const run = await runNode(
            {
                node,
                params: example.params,
                input: example.input,
                turn: EXAMPLE_TURN,
                grant: example.grant ?? { rights: node.rights, tools: node.tools ?? [] },
                effects: new Map(effects.map((effect) => [effect.id, effect])),
                tools: new Map(tools.map((tool) => [tool.id, tool])),
                key: `${node.id}:${example.name}`,
            },
            fake.ports,
        )
        const output = canonicalJson(run.output) === canonicalJson(example.output) ? [] : ["output differs"]
        return [...output, ...effectMismatches(example.effects, fake.executed)]
    } catch (cause) {
        return [`threw ${cause instanceof Error ? cause.message : String(cause)}`]
    }
}

/** The mismatches of every example of every node, by `<node id> / <example name>`; empty means the list conforms. */
export const nodeListMismatches = async (
    nodes: ReadonlyArray<NodeDefinition>,
    effects: ReadonlyArray<EffectDefinition>,
    tools: ReadonlyArray<ToolDefinition> = [],
): Promise<Readonly<Record<string, ReadonlyArray<string>>>> => {
    const runs = await Promise.all(
        nodes.flatMap((node) =>
            node.examples.map(
                async (example) =>
                    [
                        `${node.id} / ${example.name}`,
                        await nodeExampleMismatches(node, example, effects, tools),
                    ] as const,
            ),
        ),
    )
    return Object.fromEntries(runs.filter(([, mismatches]) => mismatches.length > 0))
}
