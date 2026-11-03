import { isDeepStrictEqual } from "node:util"
import type { z } from "zod"
import type { ExampleEffect, NodeDefinition } from "../node/node.types"
import type { Namespaced } from "../schema/schema.types"
import { fakeNodeContext } from "./node-context"

/** An effect of the host's vocabulary: its id and the shape of its payload. */
export interface EffectVocabularyEntry {
    readonly id: Namespaced
    readonly payload: z.ZodType
}

const kindOf = (effect: ExampleEffect): Namespaced => (typeof effect === "string" ? effect : effect.kind)

/** Runs every example of a node under a fake context and answers what is wrong: an empty list means the node conforms. */
export const runNodeExamples = async <I extends z.ZodType, O extends z.ZodType>(
    node: NodeDefinition<I, O>,
    effects: ReadonlyArray<EffectVocabularyEntry> = [],
): Promise<ReadonlyArray<string>> => {
    const problems: Array<string> = []
    for (const example of node.examples) {
        const label = `${node.id}: ${example.name}`
        const context = fakeNodeContext({
            grant: example.grant ?? { rights: node.rights },
            ...(example.store === undefined ? {} : { store: example.store }),
            ...(example.params === undefined ? {} : { params: node.params?.parse(example.params) as Record<string, unknown> }),
            ...(example.model === undefined ? {} : { model: example.model }),
        })
        const given = node.input.safeParse(example.input)
        if (!given.success) {
            problems.push(`${label}: the input does not fit the node's input schema`)
            continue
        }
        const answer = node.output.safeParse(await node.run(given.data, context))
        if (!answer.success) {
            problems.push(`${label}: the output does not fit the node's output schema`)
            continue
        }
        if (!isDeepStrictEqual(answer.data, node.output.parse(example.output))) {
            problems.push(`${label}: the output differs from the example's`)
        }
        const recorded = context.effects.map((one) => one.kind)
        if (!isDeepStrictEqual(recorded, example.effects.map(kindOf))) {
            problems.push(`${label}: the effects ${recorded.join(",")} differ from the example's`)
        }
        for (const [index, expected] of example.effects.entries()) {
            const entry = effects.find((one) => one.id === kindOf(expected))
            const payload = context.effects[index]?.payload
            if (entry !== undefined && !entry.payload.safeParse(payload).success) {
                problems.push(`${label}: the payload of ${kindOf(expected)} does not fit its schema`)
            }
            if (typeof expected !== "string" && expected.payload !== undefined) {
                if (!isDeepStrictEqual(payload, expected.payload)) {
                    problems.push(`${label}: the payload of ${kindOf(expected)} differs from the example's`)
                }
            }
        }
    }
    return problems
}
